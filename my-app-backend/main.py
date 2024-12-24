import flask
import sqlite3
import logging
from flask_cors import CORS

app = flask.Flask(__name__)
CORS(app)
logger = logging.getLogger("my-app-backend")
state = {}

def init_state():
    global state
    initial_grid = [[0 for _ in range(60)] for _ in range(20)]
    initial_grid[10][30] = 1
    state["grid"] = initial_grid
    return state

@app.route('/')
def index():
    return "Hello, World!"

@app.route('/state', methods=['GET'])
def get_state():
    global state
    logger.info(f"Getting state: {state}")
    return state

@app.route('/state', methods=['POST'])
def set_state():
    global state
    print("request.json", flask.request.json)
    state = flask.request.json
    logger.info(f"Setting state: {state}")
    return state

@app.route('/reset', methods=['POST'])
def reset():
    global state
    state = init_state()
    return "reset successful"

if __name__ == '__main__':
    init_state()
    app.run(debug=True, host='0.0.0.0', port=8080)

