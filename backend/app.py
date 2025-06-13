
import re
import os
import logging
import json
import uuid
import asyncio
from flask import Flask, request, jsonify, Response, send_from_directory # Removed render_template
from flask_cors import CORS
from flask_bcrypt import Bcrypt # For password hashing
import jwt # For JWT handling
from werkzeug.utils import secure_filename
from waitress import serve
from datetime import datetime, timezone, timedelta
from functools import wraps # For decorators

# --- Initialize Logging and Configuration First ---
import config # Ensure this is first
config.setup_logging() # Configure logging based on config
logger = logging.getLogger(__name__) # Get logger for this module

# --- Import Core Modules ---
import database
import ai_core
import utils
from protocols import ModelContextProtocol, AgenticContextProtocol

  # --- Helper to collect all items from an async generator
async def collect_async_gen(async_gen):
    return [item async for item in async_gen]

# --- Global Flask App Setup ---
backend_dir = os.path.dirname(__file__)
# template_folder and static_folder are no longer strictly needed for serving the primary UI
# but Flask might still use them if other extensions or parts of Flask serve static files directly.
# For a pure API, they could be removed if not used by any other Flask functionality.
template_folder = os.path.join(backend_dir, 'templates')
static_folder = os.path.join(backend_dir, 'static')

if not os.path.exists(template_folder): logger.warning(f"Template folder not found: {template_folder} (Note: Flask is now API-only for main UI)")
if not os.path.exists(static_folder): logger.warning(f"Static folder not found: {static_folder} (Note: Flask is now API-only for main UI)")

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)

CORS(app, resources={r"/*": {"origins": "*"}})
bcrypt = Bcrypt(app)
logger.info("CORS configured to allow all origins ('*'). This is suitable for development/campus LAN but insecure for public deployment.")

app.config['UPLOAD_FOLDER'] = config.UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024 # 64MB limit
logger.info(f"Upload folder: {app.config['UPLOAD_FOLDER']}")
logger.info(f"Max upload size: {app.config['MAX_CONTENT_LENGTH'] / (1024*1024)} MB")

try:
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    logger.info(f"Upload directory ensured: {app.config['UPLOAD_FOLDER']}")
except OSError as e:
    logger.error(f"Could not create upload directory {app.config['UPLOAD_FOLDER']}: {e}", exc_info=True)

app_db_ready = False
app_ai_ready = False
app_vector_store_ready = False


def initialize_app():
    global app_db_ready, app_ai_ready, app_vector_store_ready
    if hasattr(app, 'initialized') and app.initialized:
        return

    logger.info("--- Starting Application Initialization ---")

    logger.info("Initializing Database (MongoDB)...")
    app_db_ready = database.init_db()
    if app_db_ready:
        logger.info("Database (MongoDB) initialization successful.")
    else:
        logger.critical("Database (MongoDB) initialization failed. Auth and data persistence will be unavailable.")

    logger.info("Initializing AI components...")
    embed_instance, llm_instance = ai_core.initialize_ai_components()
    if not embed_instance or not llm_instance:
         logger.warning("AI components (LLM/Embeddings) failed to initialize. Check Ollama connection and model names. Chat/Analysis/Upload features relying on AI will be unavailable.")
         app_ai_ready = False
    else:
         app_ai_ready = True
         logger.info("AI components initialized successfully.")

    if ai_core.NOUGAT_AVAILABLE:
        logger.info("Attempting to initialize Nougat PDF processor...")
        ai_core.initialize_nougat_model()
        if ai_core.nougat_model_instance:
            logger.info("Nougat PDF processor initialized.")
        else:
            logger.warning("Nougat PDF processor FAILED to initialize. Mindmap quality for complex PDFs may be affected, fallback will be used.")
    else:
        logger.warning("Nougat PDF processor is not available. Mindmap quality for complex PDFs may be affected, fallback will be used.")

    if app_ai_ready:
        logger.info("Loading FAISS vector store...")
        if ai_core.load_vector_store():
            app_vector_store_ready = True
            index_size = getattr(getattr(ai_core.vector_store, 'index', None), 'ntotal', 0)
            logger.info(f"FAISS vector store loaded successfully (or is empty). Index size: {index_size}")
        else:
            app_vector_store_ready = False
            logger.warning("Failed to load existing FAISS vector store or it wasn't found. RAG will start with an empty index until uploads.")
    else:
         app_vector_store_ready = False
         logger.warning("Skipping vector store loading because AI components failed to initialize.")

    # Ensure podcast audio folder exists
    podcast_audio_dir = config.PODCAST_AUDIO_FOLDER
    if not os.path.exists(podcast_audio_dir):
        try:
            os.makedirs(podcast_audio_dir)
            logger.info(f"Created podcast audio directory: {podcast_audio_dir}")
        except OSError as e:
            logger.error(f"Could not create podcast audio directory {podcast_audio_dir}: {e}")
    # Also ensure user-specific subfolders can be created by ai_core.text_to_speech_gtts

    app.initialized = True
    logger.info("--- Application Initialization Complete ---")
    if not app_db_ready:
         logger.critical("Initialization completed with Database errors. Core functionality will be unavailable.")
    elif not app_ai_ready:
         logger.warning("Initialization completed, but AI components failed. Some features unavailable.")


@app.before_request
def ensure_initialized():
    if not hasattr(app, 'initialized') or not app.initialized:
        initialize_app()

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]

        if not token:
            return jsonify({"message": "Token is missing!", "error": "Unauthorized"}), 401

        if not app_db_ready:
             logger.error("Attempted access to protected route, but Database is not ready.")
             return jsonify({"message": "Service temporarily unavailable (Database error).", "error": "Service Unavailable"}), 503

        try:
            data = jwt.decode(token, config.JWT_SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
            current_user = database.get_user_by_id(data.get('user_id'))
            if not current_user:
                 logger.warning(f"Token contains invalid user_id: {data.get('user_id')}. User not found.")
                 return jsonify({"message": "Invalid token (User not found)!", "error": "Unauthorized"}), 401
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired.")
            return jsonify({"message": "Token has expired!", "error": "Unauthorized"}), 401
        except jwt.InvalidTokenError:
            logger.warning("Token is invalid.")
            return jsonify({"message": "Token is invalid!", "error": "Unauthorized"}), 401
        except Exception as e:
            logger.error(f"Unexpected error during token validation: {e}", exc_info=True)
            return jsonify({"message": "Error processing token", "error": "Unauthorized"}), 401

        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/')
def api_root():
    logger.info("Flask backend root accessed. API is active.")
    return jsonify({
        "message": "Flask AI Tutor Backend is running.",
        "status": "API Operational",
        "note": "Access the frontend via the Next.js application."
    }), 200

@app.route('/register', methods=['POST'])
def register():
    if not app_db_ready:
        return jsonify({"error": "Database service unavailable for registration."}), 503
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')
    firstname = data.get('firstname')
    lastname = data.get('lastname')
    gender = data.get('gender')
    mobile = data.get('mobile')
    organization = data.get('organization')

    if not all([username, password, email, firstname, lastname]):
        return jsonify({"error": "Required fields: First name, Last name, Username, Email, Password."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long."}), 400

    if database.get_user_by_username(username) is not None:
        logger.warning(f"Registration attempt with existing username: {username}")
        return jsonify({"error": "Username already exists."}), 409
    if database.get_user_by_email(email) is not None:
         logger.warning(f"Registration attempt with existing email: {email}")
         return jsonify({"error": "Email already registered."}), 409

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    user_id = database.create_user(
        username=username, hashed_password=hashed_password, email=email,
        firstname=firstname, lastname=lastname, gender=gender, mobile=mobile, organization=organization
    )

    if user_id:
        user_upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id))
        try:
            os.makedirs(user_upload_folder, exist_ok=True)
            logger.info(f"Created upload directory for new user {user_id}: {user_upload_folder}")
        except OSError as e:
            logger.error(f"Could not create upload directory for new user {user_id}: {e}")
        
        user_podcast_folder = os.path.join(config.PODCAST_AUDIO_FOLDER, str(user_id))
        try:
            os.makedirs(user_podcast_folder, exist_ok=True)
            logger.info(f"Created podcast audio directory for new user {user_id}: {user_podcast_folder}")
        except OSError as e:
            logger.error(f"Could not create podcast audio directory for new user {user_id}: {e}")

        return jsonify({"message": "User registered successfully. Please login.", "user_id": user_id}), 201
    else:
        return jsonify({"error": "Failed to register user due to a server error."}), 500


@app.route('/login', methods=['POST'])
def login():
    if not app_db_ready:
        return jsonify({"error": "Database service unavailable for login."}), 503
    data = request.get_json()
    identifier = data.get('username') 
    password = data.get('password')

    if not identifier or not password:
        return jsonify({"error": "Username/Email and password are required."}), 400

    user = database.get_user_by_username(identifier)
    if user is None:
        user = database.get_user_by_email(identifier)

    if user and bcrypt.check_password_hash(user['password_hash'], password):
        token_payload = {
            'user_id': user['_id'], 
            'username': user['username'],
            'exp': datetime.now(timezone.utc) + config.JWT_ACCESS_TOKEN_EXPIRES
        }
        token = jwt.encode(token_payload, config.JWT_SECRET_KEY, algorithm=config.JWT_ALGORITHM)
        
        user_details_for_frontend = {
            "token": token,
            "username": user.get('username'),
            "email": user.get('email'),
            "firstname": user.get('firstname'),
            "lastname": user.get('lastname'),
            "gender": user.get('gender'),
            "mobile": user.get('mobile'),
            "organization": user.get('organization')
        }
        logger.info(f"Login successful for user: {user.get('username')}")
        return jsonify(user_details_for_frontend), 200
    else:
        logger.warning(f"Invalid login attempt for identifier: {identifier}")
        return jsonify({"error": "Invalid username/email or password."}), 401

@app.route('/status', methods=['GET'])
def get_status():
     vector_store_count = -1
     if app_ai_ready and app_vector_store_ready and ai_core.vector_store and hasattr(ai_core.vector_store, 'index') and ai_core.vector_store.index:
        try: vector_store_count = ai_core.vector_store.index.ntotal
        except: vector_store_count = -2 
     elif app_vector_store_ready: 
         try: vector_store_count = getattr(getattr(ai_core.vector_store, 'index', None), 'ntotal', 0)
         except: vector_store_count = -2

     status_data = {
         "status": "ok" if app_db_ready and app_ai_ready else ("error_db" if not app_db_ready else "error_ai"),
         "database_initialized": app_db_ready,
         "ai_components_loaded": app_ai_ready,
         "vector_store_loaded": app_vector_store_ready,
         "vector_store_entries": vector_store_count,
         "ollama_model": config.OLLAMA_MODEL if app_ai_ready else "N/A",
         "embedding_model": config.OLLAMA_EMBED_MODEL if app_ai_ready else "N/A",
         "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
     }
     return jsonify(status_data)

@app.route('/documents', methods=['GET'])
@token_required
def get_documents(current_user):
    user_id = current_user['_id']
    error_messages = []
    formatted_documents = []

    if app_db_ready:
        user_docs_from_db = database.get_user_documents(user_id) # This returns list of dicts from MongoDB
        for doc in user_docs_from_db:
            formatted_documents.append({
                "name": doc.get("original_filename", doc.get("filename")), # original_filename for display
                "securedName": doc.get("filename") # secured (UUID-prefixed) name for API operations
            })
        # Sort by original display name
        formatted_documents.sort(key=lambda x: x["name"].lower() if x["name"] else "")
    else:
        error_messages.append("Cannot retrieve user documents: Database unavailable.")

    response_data = {
        "uploaded_files": formatted_documents, # This should be a list of {name, securedName} objects
        "errors": error_messages if error_messages else None
    }
    return jsonify(response_data)


@app.route('/upload', methods=['POST'])
@token_required
def upload_file(current_user):
    user_id = current_user['_id']
    logger.info(f"File upload request received from user: {user_id}")

    if not app_db_ready:
        return jsonify({"error": "Cannot process upload: Database service unavailable."}), 503
    if not app_ai_ready:
         return jsonify({"error": "Cannot process upload: AI components are not ready."}), 503
    if not ai_core.embeddings:
         return jsonify({"error": "Cannot process upload: AI embeddings model is not loaded."}), 503

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({"error": "No file selected"}), 400

    original_filename = file.filename
    if not ('.' in original_filename and original_filename.rsplit('.', 1)[1].lower() in config.ALLOWED_EXTENSIONS):
        allowed_ext_str = ", ".join(config.ALLOWED_EXTENSIONS)
        return jsonify({"error": f"Invalid file type. Only {allowed_ext_str} files are allowed."}), 400


    filename_uuid = f"{uuid.uuid4()}_{secure_filename(original_filename)}"
    logger.debug(f"Generated secured filename with UUID: {filename_uuid}")

    user_upload_folder = os.path.join(app.config['UPLOAD_FOLDER'], user_id)
    try:
        os.makedirs(user_upload_folder, exist_ok=True)
    except OSError as e:
        logger.error(f"Could not create user upload directory {user_upload_folder}: {e}")
        return jsonify({"error": "Server error creating storage for your file."}), 500

    filepath = os.path.join(user_upload_folder, filename_uuid)

    try:
        file.save(filepath)
        logger.info(f"File '{original_filename}' saved to {filepath} (secured as '{filename_uuid}') for user {user_id}")

        doc_record_id = database.add_user_document_record(user_id, filename_uuid, original_filename, filepath)
        if doc_record_id is None:
            logger.error(f"Failed to save document record for user {user_id}, file {original_filename} ('{filename_uuid}').")
            if os.path.exists(filepath):
                 try: os.remove(filepath)
                 except OSError: pass
            return jsonify({"error": "Failed to record document information in database. File not processed."}), 500

        text = ai_core.extract_text_from_pdf(filepath)
        if not text or not text.strip() or text.startswith("[Error: PDF is password protected"):
            if os.path.exists(filepath):
                 try: os.remove(filepath)
                 except OSError as e_remove: logger.error(f"Error removing file {filepath} after failed text extraction: {e_remove}")
            if doc_record_id: 
                database.mark_document_indexed(doc_record_id, indexed=False, error_message="Text extraction failed or PDF protected")
                logger.info(f"Document record {doc_record_id} should be reviewed or removed due to text extraction failure.")

            err_msg = "Could not read text from PDF (possibly password protected or empty)." if text and text.startswith("[Error: PDF is password protected") else f"Could not extract text from '{original_filename}'."
            logger.error(f"{err_msg} File: {original_filename} ('{filename_uuid}') for user {user_id}. Removing file and marking record.")
            return jsonify({"error": f"{err_msg} File was not added to knowledge base."}), 400


        ai_core.cache_document_text(user_id, filename_uuid, text)
        logger.info(f"Text extracted and cached for user {user_id}, file {filename_uuid}.")

        source_metadata = {
             "source": filename_uuid, 
             "user_id": user_id,
             "doc_db_id": str(doc_record_id) 
        }
        documents = ai_core.create_chunks_from_text(text, filename_uuid, source_metadata=source_metadata)
        if not documents:
             logger.error(f"Could not create document chunks for {filename_uuid} (user {user_id}).")
             database.mark_document_indexed(str(doc_record_id), indexed=False, error_message="Chunk creation failed")
             return jsonify({"error": f"Could not process '{original_filename}' into searchable chunks. File uploaded but not added to knowledge base."}), 500

        if not ai_core.add_documents_to_vector_store(documents):
            logger.error(f"Failed to add document chunks for '{filename_uuid}' (user {user_id}) to vector store.")
            database.mark_document_indexed(str(doc_record_id), indexed=False, error_message="Vector store addition failed")
            return jsonify({"error": f"File '{original_filename}' processed, but failed to update knowledge base index."}), 500

        database.mark_document_indexed(str(doc_record_id), indexed=True)
        vector_count = getattr(getattr(ai_core.vector_store, 'index', None), 'ntotal', 0)
        logger.info(f"Successfully uploaded, processed, and indexed file '{original_filename}' ('{filename_uuid}') for user {user_id}.")

        return jsonify({
            "message": f"File '{original_filename}' uploaded and added to knowledge base successfully.",
            "filename": filename_uuid, 
            "original_filename": original_filename, 
            "vector_count": vector_count
        }), 200

    except Exception as e:
        logger.error(f"Unexpected error processing upload for user {user_id}, filename '{original_filename}' ('{filename_uuid if 'filename_uuid' in locals() else 'N/A'}'): {e}", exc_info=True)
        if 'filepath' in locals() and os.path.exists(filepath): 
             try: os.remove(filepath) 
             except OSError: pass
        if 'doc_record_id' in locals() and doc_record_id:
            database.mark_document_indexed(str(doc_record_id), indexed=False, error_message=f"Unexpected error: {type(e).__name__}")
        return jsonify({"error": f"An unexpected server error occurred: {type(e).__name__}. File processing failed."}), 500


@app.route('/analyze', methods=['POST'])
@token_required
def analyze_document(current_user):
    user_id = current_user['_id']

    if not app_ai_ready or not ai_core.llm:
         return jsonify({"error": "Analysis unavailable: AI model is not ready."}), 503

    data = request.get_json()
    filename_secured = data.get('filename') # This IS the secured filename from the frontend
    analysis_type = data.get('analysis_type') 

    if not filename_secured or not analysis_type:
        return jsonify({"error": "Filename (secured) and analysis_type required."}), 400
    
    doc_record = database.get_document_by_filename(user_id, filename_secured)
    original_filename_display = doc_record.get("original_filename", filename_secured) if doc_record else filename_secured


    if analysis_type != "podcast" and analysis_type not in config.ANALYSIS_PROMPTS:
         return jsonify({"error": f"Invalid analysis type: {analysis_type}"}), 400

    async def send_thinking_message(message: str):
        logger.info(f"[AI-THINKING-{analysis_type.upper()}] {message}")

    if analysis_type == "podcast":
        try:
            script, audio_path_part, error = asyncio.run(
                ai_core.generate_podcast_from_document(user_id, filename_secured, async_callback=send_thinking_message)
            )
            if error:
                return jsonify({"error": error, "script": script or "", "original_filename": original_filename_display}), 500
            
            if not script or not audio_path_part:
                 return jsonify({"error": "Failed to generate podcast content or audio.", "script": script or "", "original_filename": original_filename_display}), 500

            audio_url = f"{request.host_url.rstrip('/')}/serve_podcast_audio/{audio_path_part}"
            
            return jsonify({
                "message": "Podcast generated successfully.",
                "script": script,
                "audio_url": audio_url,
                "original_filename": original_filename_display
            })
        except Exception as e:
            logger.error(f"Unexpected error in /analyze (podcast) endpoint for {filename_secured}, user {user_id}: {e}", exc_info=True)
            return jsonify({"error": f"Internal server error during podcast generation: {type(e).__name__}", "original_filename": original_filename_display}), 500
    else:
        analysis_content, thinking_content_list, latex_source = asyncio.run(
            ai_core.generate_document_analysis(
                filename_secured, 
                analysis_type,
                user_id=user_id,
                async_callback=send_thinking_message
            )
        )
        response_data = {
            "content": analysis_content,
            "thinking": "\n".join(thinking_content_list) if thinking_content_list else None, 
            "latex_source": latex_source,
            "original_filename": original_filename_display
        }
        if analysis_content is None:
            logger.error(f"Unexpected None result from generate_document_analysis for '{filename_secured}' type '{analysis_type}'.")
            response_data["error"] = f"Could not generate analysis for '{original_filename_display}' due to an internal issue."
            return jsonify(response_data), 500

        if isinstance(analysis_content, str) and analysis_content.startswith("Error:"):
            status_code = 503 if "AI model" in analysis_content else (404 if "retrieve text content" in analysis_content or "not found" in analysis_content else 500)
            response_data["error"] = analysis_content
            response_data["content"] = None
            return jsonify(response_data), status_code
        else:
            return jsonify(response_data)


# --- Chat Endpoints ---

@app.route('/chat/thread', methods=['POST'])
@token_required
def create_new_chat_thread(current_user):
    user_id = current_user['_id']
    if not app_db_ready:
        return jsonify({"error": "Cannot create chat thread: Database service unavailable."}), 503
    
    data = request.get_json()
    title = data.get('title', "New Chat") 

    thread_id = database.create_chat_thread(user_id, title=title)
    if thread_id:
        logger.info(f"API: New chat thread created with ID '{thread_id}' for user '{user_id}'.")
        return jsonify({"message": "New chat thread created.", "thread_id": thread_id, "title": title}), 201
    else:
        logger.error(f"API: Failed to create new chat thread for user '{user_id}'.")
        return jsonify({"error": "Failed to create new chat thread due to a server error."}), 500

@app.route('/threads', methods=['GET'])
@token_required
def get_threads(current_user):
    user_id = current_user['_id']
    if not app_db_ready:
        return jsonify({"error": "Thread list unavailable: Database connection failed."}), 503
    threads = database.get_user_threads(user_id)
    if threads is None: 
        return jsonify({"error": "Could not retrieve threads due to a database error."}), 500
    else:
        return jsonify(threads), 200 

@app.route('/thread_history', methods=['GET'])
@token_required
def get_thread_history(current_user):
    user_id = current_user['_id']
    thread_id = request.args.get('thread_id')
    if not app_db_ready:
        return jsonify({"error": "History unavailable: Database connection failed."}), 503
    if not thread_id:
        return jsonify({"error": "Missing 'thread_id' parameter"}), 400
    messages = database.get_messages_by_thread(user_id, thread_id)
    if messages is None: 
        return jsonify({"error": "Could not retrieve history for this thread or thread is empty."}), 404 
    else:
        return jsonify(messages), 200

@app.route('/chat', methods=['POST'])
@token_required
def chat(current_user):
    import asyncio
    user_id = current_user['_id']
    logger.debug(f"Chat request received from user: {user_id}")

    if not app_db_ready or not app_ai_ready:
        logger.error("Chat prerequisites not met: DB or AI components not ready.")
        error_msg = "Chat service unavailable. Backend initializing or encountered an error."
        return jsonify({"error": error_msg, "answer": "Service temporarily down.", "thread_id": request.get_json().get('thread_id')}), 503

    data = request.get_json()
    query = data.get('query')
    thread_id = data.get('thread_id') 

    if not query or not query.strip():
        return jsonify({"error": "Query cannot be empty", "answer": "Please enter a question.", "thread_id": thread_id}), 400
    query = query.strip()
    
    document_context_name = data.get('documentContent') 
    
    is_general_query = document_context_name == config.GENERAL_QUERY_PLACEHOLDER or not document_context_name

    final_document_filter_for_rag = None
    if not is_general_query:
        final_document_filter_for_rag = document_context_name 
        logger.info(f"Chat context is document: '{final_document_filter_for_rag}'")
    else:
        logger.info("Chat context is General (no specific document). Using placeholder for ai_core if needed.")
        final_document_filter_for_rag = config.GENERAL_QUERY_PLACEHOLDER 
        
    if not thread_id:
        logger.info(f"No thread_id provided for chat from user '{user_id}'. Creating new thread.")
        first_query_words = query.split()
        potential_title = " ".join(first_query_words[:5])
        if len(first_query_words) > 5: potential_title += "..."
        
        new_thread_id_from_db = database.create_chat_thread(user_id, title=potential_title)
        if not new_thread_id_from_db:
            logger.error(f"Failed to create new thread for user '{user_id}' during chat message.")
            error_msg = "Failed to start new chat thread due to a server error."
            return jsonify({"error": error_msg, "answer": error_msg, "type": "error"}), 500
        thread_id = new_thread_id_from_db 
        logger.info(f"New thread ID '{thread_id}' created for user '{user_id}' for this chat with title '{potential_title}'.")


    logger.info(f"Processing chat query for user '{user_id}', thread '{thread_id}': '{query[:100]}...' Document context for RAG: {final_document_filter_for_rag}")

    def format_sse(data: dict) -> str:
        json_data = json.dumps(data)
        return f"data: {json_data}\n\n"

    def stream():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        thinking_messages_for_stream = [] 
        
        async def send_thinking_message_for_stream(msg): 
            thinking_messages_for_stream.append(msg)
        
        async def run_query():
            try:
                bot_answer, returned_thread_id, references, thinking_content = await ai_core.process_chat_query_with_rag_and_history(
                    user_id=user_id,
                    thread_id=thread_id, 
                    query=query,
                    model_context=None, 
                    agentic_context=None, 
                    document_filter=final_document_filter_for_rag, 
                    async_callback=send_thinking_message_for_stream 
                )
                for tmsg in thinking_messages_for_stream:
                    yield format_sse({"type": "thinking", "message": tmsg}) 
                
                yield format_sse({
                    "type": "final", 
                    "answer": bot_answer,
                    "thread_id": returned_thread_id, 
                    "references": references,
                    "thinking": thinking_content 
                })
            except Exception as e_stream:
                logger.critical(f"Critical unexpected error in /chat SSE stream for user '{user_id}', thread '{thread_id}': {e_stream}", exc_info=True)
                error_message = f"A critical unexpected server error occurred: {type(e_stream).__name__}. See backend logs."
                yield format_sse({
                    "type": "error",
                    "error": error_message,
                    "answer": error_message, 
                    "thread_id": thread_id, 
                    "thinking": f"Critical Error in stream: {type(e_stream).__name__}", 
                    "references": []
                })
        try:
            sse_events = loop.run_until_complete(collect_async_gen(run_query()))
            for event_data in sse_events:
                yield event_data
        finally:
            loop.close()

    return Response(stream(), mimetype='text/event-stream')

# --- Endpoint for Transcribing Audio ---
@app.route('/transcribe-audio', methods=['POST'])
@token_required
def transcribe_audio(current_user):
    # Basic stub, replace with actual transcription logic (e.g., Whisper)
    # This requires a library like 'openai-whisper' or 'faster-whisper'
    # and potentially a GPU for good performance.
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file part"}), 400
    audio_file = request.files['audio']
    if not audio_file or not audio_file.filename:
        return jsonify({"error": "No audio file selected"}), 400

    logger.info(f"Audio transcription request for user {current_user['_id']}, file: {audio_file.filename}")
    # Example: Save file temporarily and process (actual implementation needed)
    # temp_filename = f"temp_audio_{uuid.uuid4()}.webm" # Or whatever format it is
    # audio_file.save(temp_filename)
    # transcribed_text = "This is a placeholder for transcribed audio content." # Replace with actual transcription call
    # os.remove(temp_filename)
    # For now, returning placeholder:
    transcribed_text = "Audio transcription not yet implemented on backend."
    
    return jsonify({"text": transcribed_text})

# --- Endpoint for Renaming Chat Thread ---
@app.route('/chat/thread/<thread_id>/rename', methods=['POST'])
@token_required
def rename_chat_thread(current_user, thread_id):
    user_id = current_user['_id']
    data = request.get_json()
    new_title = data.get('new_title')

    if not new_title or not new_title.strip():
        return jsonify({"error": "New title cannot be empty."}), 400

    if not app_db_ready:
        return jsonify({"error": "Database service unavailable."}), 503

    logger.info(f"Attempting to rename thread '{thread_id}' to '{new_title}' for user '{user_id}'.")
    database.update_thread_title(user_id, thread_id, new_title.strip())
    # Assume update_thread_title handles success/failure logging or raises exceptions
    return jsonify({"message": f"Thread '{thread_id}' renamed to '{new_title}'."}), 200


# --- Endpoint for Deleting Chat Thread ---
@app.route('/chat/thread/<thread_id>', methods=['DELETE'])
@token_required
def delete_chat_thread(current_user, thread_id):
    user_id = current_user['_id']
    if not app_db_ready:
        return jsonify({"error": "Database service unavailable."}), 503
    
    logger.info(f"Attempting to delete thread '{thread_id}' for user '{user_id}'.")
    # You'll need a function in database.py to delete a thread and its messages
    success = database.delete_thread_and_messages(user_id, thread_id) # Assume this function exists
    if success:
        return jsonify({"message": f"Thread '{thread_id}' and its messages deleted successfully."}), 200
    else:
        return jsonify({"error": f"Failed to delete thread '{thread_id}'. It might not exist or an error occurred."}), 500

# --- Endpoint for Deleting a Document ---
@app.route('/document/<secured_filename>', methods=['DELETE'])
@token_required
def delete_document_endpoint(current_user, secured_filename):
    user_id = current_user['_id']
    if not app_db_ready:
        return jsonify({"error": "Database service unavailable."}), 503

    logger.info(f"Attempting to delete document '{secured_filename}' for user '{user_id}'.")
    
    # 1. Delete from Database Record
    doc_record = database.get_document_by_filename(user_id, secured_filename)
    if not doc_record:
        return jsonify({"error": "Document record not found in database."}), 404
    
    original_filename_for_log = doc_record.get("original_filename", secured_filename)
    
    db_delete_success = database.delete_document_record(user_id, secured_filename) # Assume this exists

    # 2. Delete from Vector Store (More complex, requires re-indexing or selective deletion if FAISS supports it easily)
    # For simplicity, this example might skip direct FAISS deletion or assume manual re-indexing later.
    # A robust solution would remove specific vectors from ai_core.vector_store and save.
    # ai_core.remove_document_from_vector_store(user_id, secured_filename) # Ideal
    logger.warning(f"Vector store entries for '{secured_filename}' (user {user_id}) may need manual cleanup or re-indexing if not handled by core logic.")

    # 3. Delete from File System
    file_system_delete_success = False
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], user_id, secured_filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            logger.info(f"File '{file_path}' deleted from file system for user '{user_id}'.")
            file_system_delete_success = True
        except OSError as e:
            logger.error(f"Error deleting file '{file_path}' from file system: {e}", exc_info=True)
            # Continue, but report this. DB record deletion might proceed.
    else:
        logger.warning(f"File '{file_path}' not found on file system for deletion (user '{user_id}').")
        file_system_delete_success = True # Consider it success if not there to delete

    if db_delete_success and file_system_delete_success:
        return jsonify({"message": f"Document '{original_filename_for_log}' deleted successfully."}), 200
    elif not db_delete_success:
        return jsonify({"error": f"Failed to delete document record '{original_filename_for_log}' from database."}), 500
    else: # DB deleted, but file system issue (though might be benign if file was already gone)
        return jsonify({"message": f"Document record '{original_filename_for_log}' deleted from DB, but encountered issue with file system part (check logs)."}), 207


# --- Legacy /history and /sessions, map to new thread endpoints or remove if Next.js client only uses new ones
@app.route('/history', methods=['GET'])
@token_required
def get_history(current_user): 
    user_id = current_user['_id']
    thread_id_param = request.args.get('thread_id') or request.args.get('session_id')
    if not app_db_ready: return jsonify({"error": "History unavailable: DB connection failed."}), 503
    if not thread_id_param: return jsonify({"error": "Missing 'thread_id' (or 'session_id') parameter"}), 400
    
    messages = database.get_messages_by_thread(user_id, thread_id_param)
    if messages is None: return jsonify({"error": "Could not retrieve history or thread empty."}), 404
    return jsonify(messages), 200

@app.route('/sessions', methods=['GET'])
@token_required
def get_sessions(current_user): 
    user_id = current_user['_id']
    if not app_db_ready: return jsonify({"error": "Session list unavailable: DB connection failed."}), 503
    
    threads = database.get_user_threads(user_id)
    if threads is None: return jsonify({"error": "Could not retrieve sessions/threads."}), 500
    return jsonify(threads), 200


@app.route('/serve_podcast_audio/<path:user_file_path>')
def serve_podcast_audio(user_file_path):
    if ".." in user_file_path or user_file_path.startswith("/"):
        logger.warning(f"Invalid podcast audio path requested: {user_file_path}")
        return "Invalid path", 400
        
    base_podcast_dir = os.path.abspath(config.PODCAST_AUDIO_FOLDER)
    full_file_path = os.path.join(base_podcast_dir, user_file_path)

    if not os.path.exists(full_file_path) or not os.path.isfile(full_file_path):
        logger.warning(f"Podcast audio file not found at: {full_file_path}")
        return "Audio file not found.", 404
        
    if not full_file_path.startswith(base_podcast_dir):
        logger.error(f"Attempt to access file outside podcast audio directory: {user_file_path}")
        return "Access denied.", 403

    logger.debug(f"Serving podcast audio: {user_file_path} from {base_podcast_dir}")
    try:
        return send_from_directory(base_podcast_dir, user_file_path, as_attachment=False)
    except Exception as e:
        logger.error(f"Error serving podcast audio file {user_file_path} from {base_podcast_dir}: {e}", exc_info=True)
        return "Error serving audio file.", 500


# --- Main Execution ---
if __name__ == '__main__':
    if not hasattr(app, 'initialized') or not app.initialized:
        initialize_app()

    try:
        port = int(os.getenv('FLASK_RUN_PORT', 5000))
        if not (1024 <= port <= 65535):
             logger.warning(f"Port {port} is outside the typical range (1024-65535). Using default 5000.")
             port = 5000
    except ValueError:
        port = 5000
        logger.warning(f"Invalid FLASK_RUN_PORT environment variable. Using default port {port}.")

    host = '0.0.0.0'
    logger.info(f"--- Starting Flask Server (API Mode) ---")
    logger.info(f"Serving Flask app '{app.name}'")
    logger.info(f"Configuration:")
    logger.info(f"  - Host: {host}")
    logger.info(f"  - Port: {port}")
    logger.info(f"  - Ollama URL(s): {config.OLLAMA_BASE_URLS}") 
    logger.info(f"  - LLM Model: {config.OLLAMA_MODEL}")
    logger.info(f"  - Embedding Model: {config.OLLAMA_EMBED_MODEL}")
    logger.info(f"  - Summary Buffer Limit: {config.SUMMARY_BUFFER_TOKEN_LIMIT}")
    logger.info(f"Access URLs (API Endpoints):")
    logger.info(f"  - Local API Root: http://127.0.0.1:{port}/ or http://localhost:{port}/")
    logger.info(f"  - Network API Root: http://<YOUR_MACHINE_IP>:{port}/")
    logger.info(f"Frontend should be accessed via the Next.js development server (e.g., http://localhost:9002).")


    db_status = 'Ready' if app_db_ready else 'Failed/Unavailable'
    ai_status = 'Ready' if app_ai_ready else 'Failed/Unavailable'
    index_status = 'Loaded/Ready' if app_vector_store_ready else ('Not Found/Empty' if app_ai_ready else 'Not Loaded (AI Failed)')
    logger.info(f"Component Status: DB={db_status} | AI={ai_status} | Index={index_status}")
    logger.info("Press Ctrl+C to stop the server.")
 
    serve(app, host=host, port=port, threads=8)

