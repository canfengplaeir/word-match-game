from flask import Flask
from flask_login import LoginManager, UserMixin
from app.models import User  # 确保导入User模型
from config import Config
from app.database import init_db
import os

login_manager = LoginManager()
login_manager.login_view = 'login'

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    init_db(app)
    login_manager.init_app(app)

    # 确保这行存在
    with app.app_context():
        from app import routes, models

    @login_manager.user_loader
    def load_user(user_id):
        # 用实际的数据库查询替换下面的代码
        return User.query.get(int(user_id))

    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])

    return app