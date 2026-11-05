import os
import random
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify, send_from_directory, render_template, redirect, url_for
from flask_cors import CORS
from werkzeug.utils import secure_filename
import pymysql

app = Flask(__name__)

# Configured CORS to allow all origins
CORS(app, resources={r"/*": {"origins": "*"}})

# Folder Configuration for Incident Photos
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Brevo REST API Configuration for Cloud Hosting
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
BREVO_API_KEY = os.environ.get('BREVO_API_KEY')
SENDER_EMAIL = "nsindisothabede09@gmail.com"

def send_otp_email(receiver_email, otp_code):
    payload = {
        "sender": {"name": "EcoWatch Support", "email": SENDER_EMAIL},
        "to": [{"email": receiver_email}],
        "subject": "Your OTP Verification Code - EcoWatch",
        "textContent": f"Hello,\n\nYour One-Time Password (OTP) for account verification is: {otp_code}\n\nThank you!"
    }
    
    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json"
    }

    try:
        response = requests.post(BREVO_API_URL, json=payload, headers=headers, timeout=10)
        if response.status_code in [200, 201]:
            print(f"Successfully sent email OTP to {receiver_email}")
            return True
        else:
            print(f"Brevo API Error: {response.text}")
            return False
    except Exception as e:
        print(f"Error connecting to email API: {e}")
        return False

# Robust Database Connection with Cloud-to-Local Fallback for Cross-Platform/Network Stability
def get_db_connection():
    try:
        # Try connecting to Railway Cloud Database first using environment variables or hardcoded config
        return pymysql.connect(
            host=os.environ.get('DB_HOST', 'zephyr.proxy.rlwy.net'),
            port=int(os.environ.get('DB_PORT', 47674)),
            user=os.environ.get('DB_USER', 'root'),
            password=os.environ.get('DB_PASSWORD', 'pLJPpJaCZbjklkIvGlcsMkAoNQUQbmvt'),
            database=os.environ.get('DB_NAME', 'railway'),
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=10
        )
    except Exception as cloud_err:
        print(f"Cloud DB connection timed out or failed: {cloud_err}. Falling back to local database...")
        # Fallback to local MySQL database if local testing without internet/cloud proxy is preferred
        return pymysql.connect(
            host='localhost',
            port=3306,
            user='root',
            password='',
            database='ecowatch23',
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )

# 1. API: Registration
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    fullname = data.get('fullname')
    email = data.get('email')
    password = data.get('password')

    if not fullname or not email or not password:
        return jsonify({'error': 'Please fill in all fields!'}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            existing_user = cursor.fetchone()

            otp_code = str(random.randint(100000, 999999))

            if existing_user:
                if existing_user['is_verified'] == 1:
                    return jsonify({'error': 'Email address is already registered and verified!'}), 400
                else:
                    update_sql = "UPDATE users SET fullname = %s, password = %s, otp = %s WHERE email = %s"
                    cursor.execute(update_sql, (fullname, password, otp_code, email))
            else:
                sql = """
                    INSERT INTO users (fullname, email, password, role, otp, is_verified) 
                    VALUES (%s, %s, %s, 'resident', %s, 0)
                """
                cursor.execute(sql, (fullname, email, password, otp_code))
            
            connection.commit()

            try:
                send_otp_email(email, otp_code)
            except Exception as mail_err:
                print("Email API Non-fatal Warning:", str(mail_err))

            return jsonify({
                'message': 'Registration successful! Please check your email inbox for your OTP code.',
                'email': email
            }), 201
    except Exception as e:
        connection.rollback()
        print("Database Error during registration:", str(e))
        return jsonify({'error': str(e)}), 500
    finally:
        connection.close()

# 1.1. API: Verify OTP after Registration
@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    email = data.get('email')
    entered_otp = data.get('otp')

    if not email or not entered_otp:
        return jsonify({'error': 'Email and OTP are required!'}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()

            if user and user['otp'] == entered_otp:
                cursor.execute("UPDATE users SET is_verified = 1, otp = NULL WHERE email = %s", (email,))
                connection.commit()
                return jsonify({'message': 'Account verified successfully! You can now log in.'}), 200
            else:
                return jsonify({'error': 'Invalid OTP or email!'}), 400
    finally:
        connection.close()

# 2. API: Login
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Please enter both email and password!'}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE email = %s AND password = %s", (email, password))
            user = cursor.fetchone()

            if user:
                if user['is_verified'] == 0:
                    return jsonify({'error': 'Please verify your account with OTP before logging in!'}), 403

                return jsonify({
                    'message': 'Login successful!',
                    'user': {
                        'id': user['id'],
                        'fullname': user['fullname'],
                        'email': user['email'],
                        'role': user['role']
                    }
                }), 200
            else:
                return jsonify({'error': 'Invalid email or password!'}), 401
    finally:
        connection.close()

# 3. API: Admin - Fetch All Incident Reports & Cleanup Crew List
@app.route('/admin/dashboard-data', methods=['GET'])
def get_admin_dashboard_data():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT r.id, r.issue_type, r.location, r.description, r.image_path, r.status, r.created_at, r.latitude, r.longitude, 
                       u.fullname AS reported_by, ta.crew_id
                FROM reports r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN task_assignments ta ON r.id = ta.report_id
                ORDER BY r.created_at DESC
            """)
            reports = cursor.fetchall()
            for r in reports:
                if r.get('created_at'):
                    r['created_at'] = str(r['created_at'])

            cursor.execute("SELECT id, fullname FROM users WHERE role = 'crew'")
            crew_members = cursor.fetchall()

            return jsonify({
                'reports': reports,
                'crew_members': crew_members
            }), 200
    except Exception as e:
        print("Error in admin dashboard:", str(e))
        return jsonify({'error': str(e)}), 500
    finally:
        connection.close()

# 4. API: Admin - Dispatch Cleanup Crew
@app.route('/admin/assign-task', methods=['POST'])
def assign_task():
    data = request.get_json()
    report_id = data.get('report_id')
    crew_id = data.get('crew_id')

    if not report_id or not crew_id:
        return jsonify({'error': 'Missing report ID or crew member!'}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = "UPDATE reports SET status = 'Assigned' WHERE id = %s"
            cursor.execute(sql, (report_id,))

            cursor.execute("SELECT * FROM task_assignments WHERE report_id = %s", (report_id,))
            existing = cursor.fetchone()

            if existing:
                cursor.execute("UPDATE task_assignments SET crew_id = %s WHERE report_id = %s", (crew_id, report_id))
            else:
                cursor.execute("INSERT INTO task_assignments (report_id, crew_id) VALUES (%s, %s)", (report_id, crew_id))

            connection.commit()
            return jsonify({'message': 'Cleanup crew dispatched successfully!'}), 200
    except Exception as e:
        print("Error in assign_task:", str(e))
        return jsonify({'error': str(e)}), 500
    finally:
        connection.close()

# 5. API: Admin - Update Report Status
@app.route('/admin/update-status', methods=['POST'])
def update_report_status():
    data = request.get_json()
    report_id = data.get('report_id')
    new_status = data.get('status')

    if not report_id or not new_status:
        return jsonify({'error': 'Report ID and status are required!'}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            sql = "UPDATE reports SET status = %s WHERE id = %s"
            cursor.execute(sql, (new_status, report_id))
            connection.commit()
            return jsonify({'message': f'Report status successfully updated to {new_status}!'}), 200
    except Exception as e:
        print("Error in update_report_status:", str(e))
        return jsonify({'error': str(e)}), 500
    finally:
        connection.close()

# 6. API: Resident - Submit Report with Mandatory Photo & GPS
@app.route('/api/submit-report', methods=['POST'])
def submit_report():
    try:
        user_id = request.form.get('user_id')
        issue_type = request.form.get('issue_type')
        location = request.form.get('location')
        description = request.form.get('description')
        image_file = request.files.get('image')
        latitude = request.form.get('latitude')
        longitude = request.form.get('longitude')

        if not all([user_id, issue_type, location, description, image_file]):
            return jsonify({'message': 'All fields including an incident photo are mandatory!'}), 400

        filename = secure_filename(image_file.filename)
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        image_file.save(image_path)

        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                query = """
                    INSERT INTO reports (user_id, issue_type, location, description, image_path, status, latitude, longitude)
                    VALUES (%s, %s, %s, %s, %s, 'Pending', %s, %s)
                """
                cursor.execute(query, (user_id, issue_type, location, description, filename, latitude, longitude))
                connection.commit()
                return jsonify({'message': 'Report submitted successfully with photo and GPS!'}), 201
        finally:
            connection.close()

    except Exception as e:
        print("Error in submit_report:", str(e))
        return jsonify({'message': f'Server Error: {str(e)}'}), 500

# 7. API: Resident - Fetch Own Reports
@app.route('/api/resident-reports', methods=['GET'])
def get_resident_reports():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'message': 'User ID is required'}), 400

    try:
        connection = get_db_connection()
        try:
            with connection.cursor() as cursor:
                query = "SELECT id, issue_type, location, description, image_path, status, created_at FROM reports WHERE user_id = %s ORDER BY id DESC"
                cursor.execute(query, (user_id,))
                reports = cursor.fetchall()
                for r in reports:
                    if r.get('created_at'):
                        r['created_at'] = str(r['created_at'])
                return jsonify({'reports': reports}), 200
        finally:
            connection.close()

    except Exception as e:
        print("Error in get_resident_reports:", str(e))
        return jsonify({'message': f'Server Error: {str(e)}'}), 500

# 8. API: Crew - Get Assigned Tasks
@app.route('/api/crew-tasks', methods=['GET'])
def get_crew_tasks():
    crew_id = request.args.get('crew_id')
    if not crew_id:
        return jsonify({'message': 'Crew ID is required'}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            query = """
                SELECT r.id, r.issue_type, r.location, r.description, r.image_path, r.status, r.latitude, r.longitude, r.created_at 
                FROM reports r
                JOIN task_assignments ta ON r.id = ta.report_id
                WHERE ta.crew_id = %s
                ORDER BY r.id DESC
            """
            cursor.execute(query, (crew_id,))
            tasks = cursor.fetchall()
            for t in tasks:
                if t.get('created_at'):
                    t['created_at'] = str(t['created_at'])
            return jsonify({'tasks': tasks}), 200
    except Exception as e:
        print("Error in get_crew_tasks:", str(e))
        return jsonify({'message': str(e)}), 500
    finally:
        connection.close()

# 9. API: Crew - Mark Task as Resolved
@app.route('/api/resolve-task', methods=['POST'])
def resolve_task():
    data = request.get_json()
    report_id = data.get('report_id')

    if not report_id:
        return jsonify({'message': 'Report ID is required'}), 400

    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE reports SET status = 'Resolved' WHERE id = %s", (report_id,))
            connection.commit()
            return jsonify({'message': 'Task marked as resolved successfully!'}), 200
    finally:
        connection.close()

# 10. Serve Photo Files
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# 11. API / Route: Logout
@app.route('/logout')
def logout():
    return redirect(url_for('home'))

# Template Routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/admin-portal.html')
def admin_portal():
    return render_template('admin-portal.html')

@app.route('/crew-portal.html')
def crew_portal():
    return render_template('crew-portal.html')

@app.route('/resident-portal.html')
def resident_portal():
    return render_template('resident-portal.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)