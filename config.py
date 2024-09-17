import os

class Config(object):
    DEBUG = False
    TESTING = False
    SQLALCHEMY_DATABASE_URI = 'sqlite:///site.db'
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'jdlfjds7834kjfksdfhdsds'
    TEACHER_REGISTRATION_KEY = os.environ.get('TEACHER_REGISTRATION_KEY') or '111111'
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')

class ProductionConfig(Config):
    pass

class DevelopmentConfig(Config):
    DEBUG = True

class TestingConfig(Config):
    TESTING = True
