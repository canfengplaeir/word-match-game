from functools import wraps
import json
import os
import glob
from flask import abort, current_app as app, flash, render_template, send_file, send_from_directory, session, url_for, redirect, request, jsonify
from flask_login import current_user, login_user, logout_user, login_required
from app.helpers import *
from app.forms import *
from app.models import *
from werkzeug.utils import secure_filename

# Home route
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/word_match')
def word_match():
    return render_template('word_match.html')

@app.route('/word_editor')
def word_editor():
    return render_template('word_editor.html')


@app.route('/api/dictionary-list')
def dictionary_list():
    try:
        with open('dictionary_list.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
        files = [f for f in os.listdir(config['directory']) if f.endswith('.json')]
        return jsonify(files)
    except Exception as e:
        print('错误:', str(e))
        return jsonify({'error': '内部服务器错误'}), 500

@app.route('/api/dictionary/<file>')
def dictionary(file):
    try:
        with open('dictionary_list.json', 'r', encoding='utf-8') as f:
            config = json.load(f)
        file_path = os.path.join(config['directory'], file)
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        print('错误:', str(e))
        return jsonify({'error': '内部服务器错误'}), 500

def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'role' not in session or session['role'] not in roles:
                abort(401)
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.route('/<path:path>')
@role_required('teacher', 'admin')
def serve_static(path):
    return send_from_directory('.', path)


@app.route("/register", methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Your account has been created! You are now able to log in', 'success')
        return redirect(url_for('login'))
    return render_template('register.html', title='Register', form=form)

@app.route("/login", methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data):
            login_user(user)
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('index'))
        else:
            flash('Login Unsuccessful. Please check email and password', 'danger')
    return render_template('login.html', title='Login', form=form)

@app.route("/logout")
def logout():
    logout_user()
    return redirect(url_for('index'))

from flask import render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from app.models import User, Word, StudentProgress

@app.route('/teacher_dashboard')
@login_required
def teacher_dashboard():
    teacher_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(current_user.id))
    word_folder = os.path.join(teacher_folder, 'word_files')
    os.makedirs(word_folder, exist_ok=True)
    
    word_files = [f for f in os.listdir(word_folder) if f.endswith('.json')]
    grades = set(StudentProgress.query.filter_by(teacher_id=current_user.id).with_entities(StudentProgress.grade).distinct())
    classes = set(StudentProgress.query.filter_by(teacher_id=current_user.id).with_entities(StudentProgress.class_name).distinct())
    return render_template('teacher_dashboard.html', word_files=word_files, grades=grades, classes=classes)

@app.route('/upload_students', methods=['POST'])
@login_required
def upload_students():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'})
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    if file and file.filename.endswith('.txt'):
        filename = secure_filename(file.filename)
        if not filename:
            return jsonify({'success': False, 'error': 'Invalid filename'})
        
        grade = request.form.get('grade')
        class_name = request.form.get('class')
        
        teacher_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(current_user.id), 'student_lists')
        os.makedirs(teacher_folder, exist_ok=True)
        file_path = os.path.join(teacher_folder, f"{grade}_{class_name}_{filename}")
        file.save(file_path)
        
        # 验证文件格式
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            if not all(line.strip() for line in lines):
                os.remove(file_path)
                return jsonify({'success': False, 'error': 'Invalid file format'})
        
        # 更新或创建学生进度记录
        for student_name in lines:
            student_name = student_name.strip()
            student_progress = StudentProgress.query.filter_by(
                teacher_id=current_user.id,
                grade=grade,
                class_name=class_name,
                student_name=student_name
            ).first()
            
            if not student_progress:
                student_progress = StudentProgress(
                    teacher_id=current_user.id,
                    grade=grade,
                    class_name=class_name,
                    student_name=student_name
                )
                db.session.add(student_progress)
        
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Invalid file type'})

@app.route('/edit_word_file/<filename>')
@login_required
def edit_word_file(filename):
    return render_template('word_editor.html', filename=filename)

@app.route('/save_word_file', methods=['POST'])
@login_required
def save_word_file():
    data = request.json
    filename = data.get('filename')
    words = data.get('words')
    user_id = current_user.id
    
    user_dir = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id), 'word_files')
    os.makedirs(user_dir, exist_ok=True)
    
    file_path = os.path.join(user_dir, filename)
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/get_word_file_list')
@login_required
def get_word_file_list():
    user_id = current_user.id
    word_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id), 'word_files')
    os.makedirs(word_folder, exist_ok=True)
    files = [f for f in os.listdir(word_folder) if f.endswith('.json')]
    return jsonify({'success': True, 'files': files})

@app.route('/upload_word_file', methods=['POST'])
@login_required
def upload_word_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'})
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    if file and file.filename.endswith('.json'):
        filename = secure_filename(file.filename)
        if not filename:
            return jsonify({'success': False, 'error': 'Invalid filename'})
        
        teacher_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(current_user.id))
        word_folder = os.path.join(teacher_folder, 'word_files')
        os.makedirs(word_folder, exist_ok=True)
        file_path = os.path.join(word_folder, filename)
        file.save(file_path)
        return jsonify({'success': True, 'filename': filename})
    return jsonify({'success': False, 'error': 'Invalid file type'})

@app.route('/download_word_file/<filename>')
@login_required
def download_word_file(filename):
    teacher_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(current_user.id))
    word_folder = os.path.join(teacher_folder, 'word_files')
    return send_file(os.path.join(word_folder, filename), as_attachment=True)

@app.route('/get_classes/<grade>')
@login_required
def get_classes(grade):
    classes = StudentProgress.query.filter_by(teacher_id=current_user.id, grade=grade).with_entities(StudentProgress.class_name).distinct()
    return jsonify([c.class_name for c in classes])

@app.route('/get_students/<grade>/<class_name>')
@login_required
def get_students(grade, class_name):
    students = StudentProgress.query.filter_by(
        teacher_id=current_user.id,
        grade=grade,
        class_name=class_name
    ).with_entities(StudentProgress.student_name).distinct()
    return jsonify([s.student_name for s in students])

@app.route('/student_progress/<grade>/<class_name>/<student_name>')
@login_required
def student_progress(grade, class_name, student_name):
    progress = StudentProgress.query.filter_by(
        teacher_id=current_user.id,
        grade=grade,
        class_name=class_name,
        student_name=student_name
    ).all()
    return render_template('student_progress.html', student=student_name, progress=progress)

@app.route('/update_progress', methods=['POST'])
@login_required
def update_progress():
    data = request.json
    progress = StudentProgress.query.get(data['progress_id'])
    if progress and progress.teacher_id == current_user.id:
        progress.learned = data['learned']
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'Invalid progress update'})

@app.route('/add_student', methods=['POST'])
@login_required
def add_student():
    name = request.form.get('name')
    if name:
        student_file = f'students_{current_user.id}.txt'
        with open(student_file, 'a', encoding='utf-8') as f:
            f.write(f"{name}\n")
        return jsonify({'success': True, 'name': name})
    return jsonify({'success': False, 'error': 'No name provided'}), 400

@app.route('/remove_student', methods=['POST'])
@login_required
def remove_student():
    name = request.form.get('name')
    if name:
        student_file = f'students_{current_user.id}.txt'
        students = []
        with open(student_file, 'r', encoding='utf-8') as f:
            students = [line.strip() for line in f.readlines() if line.strip() != name]
        with open(student_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(students) + '\n')
        return jsonify({'success': True})
    return jsonify({'success': False, 'error': 'No name provided'}), 400

@app.route('/add_word', methods=['POST'])
@login_required
def add_word():
    word = request.form.get('word')
    meaning = request.form.get('meaning')
    
    if word and meaning:
        new_word = Word(word=word, meaning=meaning, added_by=current_user.id)
        db.session.add(new_word)
        db.session.commit()
        flash('新单词已添加。', 'success')
    else:
        flash('请填写所有字段。', 'error')
    
    return redirect(url_for('teacher_dashboard'))

@app.route('/get_student_list/<grade>/<class_name>')
@login_required
def get_student_list(grade, class_name):
    teacher_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(current_user.id), 'student_lists')
    file_pattern = f"{grade}_{class_name}_*.txt"
    matching_files = glob.glob(os.path.join(teacher_folder, file_pattern))
    
    if matching_files:
        with open(matching_files[0], 'r', encoding='utf-8') as f:
            students = [line.strip() for line in f.readlines()]
        return jsonify(students)
    else:
        return jsonify([])

@app.route('/get_file_list')
@login_required
def get_file_list():
    teacher_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(current_user.id))
    files = [f for f in os.listdir(teacher_folder) if os.path.isfile(os.path.join(teacher_folder, f))]
    return jsonify(files)

@app.route('/upload_file', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'})
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    if file:
        filename = secure_filename(file.filename)
        if not filename:
            return jsonify({'success': False, 'error': 'Invalid filename'})
        
        teacher_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(current_user.id))
        os.makedirs(teacher_folder, exist_ok=True)
        file_path = os.path.join(teacher_folder, filename)
        file.save(file_path)
        return jsonify({'success': True, 'filename': filename})
    return jsonify({'success': False, 'error': 'File upload failed'})

@app.route('/download_file/<filename>')
@login_required
def download_file(filename):
    teacher_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(current_user.id))
    return send_file(os.path.join(teacher_folder, filename), as_attachment=True)

@app.route('/delete_file', methods=['POST'])
@login_required
def delete_file():
    filename = request.form.get('filename')
    if not filename:
        return jsonify({'success': False, 'error': 'No filename provided'})
    
    teacher_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(current_user.id))
    file_path = os.path.join(teacher_folder, filename)
    
    if os.path.exists(file_path):
        os.remove(file_path)
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'error': 'File not found'})

@app.route('/delete_word_file', methods=['POST'])
@login_required
def delete_word_file():
    filename = request.form.get('filename')
    if not filename:
        return jsonify({'success': False, 'error': 'No filename provided'})
    
    user_id = current_user.id
    word_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id), 'word_files')
    file_path = os.path.join(word_folder, filename)
    
    if os.path.exists(file_path):
        os.remove(file_path)
        return jsonify({'success': True})
    else:
        return jsonify({'success': False, 'error': 'File not found'})

@app.route('/load_word_file/<filename>')
@login_required
def load_word_file(filename):
    user_id = current_user.id
    word_folder = os.path.join(app.config['UPLOAD_FOLDER'], str(user_id), 'word_files')
    file_path = os.path.join(word_folder, filename)
    
    if not os.path.exists(file_path):
        return jsonify({'success': False, 'error': 'File not found'})
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            words = json.load(f)
        return jsonify({'success': True, 'words': words})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/check_login')
def check_login():
    return jsonify({'logged_in': current_user.is_authenticated})
