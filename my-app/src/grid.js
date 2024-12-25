import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const GRID_WIDTH = 600
const GRID_HEIGHT = 200

// const BOX_SIZE = 10
// const STEP_SIZE = 10

// defining the grid state
// for now fixing the grid size to 60 X 20
// for each box in the grid, we can have a state 0-4
// 0: empty
// 1: black box
// 2: green box 
// 3: red box

// idle threshold is the time after which the current position of the cursor is taken into account
// this is to ensure that the cursor is idle for some time before taking a picture
const IDLE_THRESHOLD = 300;

const BACKEND_URL = process.env.BACKEND_URL || "http://98.70.50.35:9999"
const SOCKET_URL = process.env.SOCKET_URL || "ws://98.70.50.35:9999"
const socket = io(SOCKET_URL);

const Grid = () => {

    const [messages, setMessages] = useState([]);
    const [cursor, setCursor] = useState();
    const cursorRef = useRef(cursor);
    const gridRef = useRef(null);
    const [gridState, setGridState] = useState({
        grid: Array.from({length: 20}, () => Array(60).fill(-1)),
    });
    const [resetting, setResetting] = useState(false);

    
    // fetch the grid state from the backend
    // also add the event listener for the keydown
    useEffect(() => {
        const init = async () => {
            const response = await fetch(`${BACKEND_URL}/state`);
            const body = await response.json();
            setGridState(body);
            setCursor(body.cursor);

            socket.on("connect", () => {
                console.log("Connected to WebSocket server");
            });

            socket.on("disconnect", () => {
                console.log("Disconnected from WebSocket server");
            });

            socket.on("message", (data) => {
                console.log("message from websocket", data);
                switch(data.type){
                    case "message":
                        setMessages((prev) => [...prev, data.message]);
                        break;
                    case "state":
                        setGridState(data.state);
                        setCursor(data.state.cursor);
                        break;
                    case "error":
                        setMessages((prev) => [...prev, data.message]);
                        break;
                    case "cursor":
                        setCursor(data.cursor);
                        break;
                    case "reset_ok":
                        window.location.reload();
                        break;
                    default:
                        console.log("unknown message type", data);
                }
            });

            window.addEventListener('keydown', handleKeyDown);
        }
        init();
    }, []);


    const addKeylog = async (key) => {
        socket.emit("keylog", {key: key, timestamp: Date.now()});
    }

    const handleKeyDown = async (event) => {
        console.log("key down", event.key);
        const currentCursor = cursorRef.current;
        if (event.key === 'ArrowUp') {
            if(!currentCursor || currentCursor[0] > 0){
                addKeylog('up');
            }
        }
        else if (event.key === 'ArrowDown') {
            if(!currentCursor || currentCursor[0] < 19){
                addKeylog('down');
            }
        }
        else if (event.key === 'ArrowLeft') {
            if(!currentCursor || currentCursor[1] > 0){
                addKeylog('left');
            }
        }
        else if (event.key === 'ArrowRight') {
            if(!currentCursor || currentCursor[1] < 59){
                addKeylog('right');
            }
        }
    }

    useEffect(() => {
        if(gridState && gridState.grid){
            gridRef.current = gridState;
        }
    }, [gridState]);

    // always scroll to the bottom of the messages container
    useEffect(() => {
        const messagesContainer = document.querySelector('.messages-container');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, [messages]);

    const isCursorInCell = (cursor, cell) => {
        if(!cursor || !cell){
            return false;
        }
        return cursor[0] === cell[0] && cursor[1] === cell[1];
    }

    const handleReset = () => {
        socket.emit("reset");
    }

    return <div className="main-container">
        <div className="grid-container" style={{width: GRID_WIDTH, height: GRID_HEIGHT}}>
            {gridState && gridState.grid && gridState.grid.map((row, rowIndex) => (
                <div className="grid-row" key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                        <div 
                            className={`grid-cell ${isCursorInCell(cursor, [rowIndex, cellIndex]) ? 'border-black' : ''}`}
                            key={cellIndex} 
                            style={{backgroundColor: cell === 1 ? 'green' : cell === 2 ? 'red' : 'white'}}
                        ></div>
                    ))}
                </div>
            ))}
        </div>
        <button onClick={handleReset}>Reset</button>
        <div className="messages-container">
            {messages.map((message, index) => (
                <div className="message" key={index}>{message}</div>
            ))}
        </div>
    </div>
}

export default Grid;