import { useState, useEffect, useRef } from 'react';

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

const commitGridStateToBackend = (gridState) => {
    try{
        fetch(`${BACKEND_URL}/state`, {
            method: 'POST',
            body: JSON.stringify(gridState),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }catch(error){
        console.error('Error committing grid state to backend', error);
    }
}
const takeImage = async (cursorPosition) => {
    const response = await fetch(`${BACKEND_URL}/take_image`, {
        method: 'POST',
        body: JSON.stringify({cursor: cursorPosition}),
        headers: {
            'Content-Type': 'application/json'
        }
    });
    return response.json();
}

const analyzeImage = async (cursorPosition) => {
    const response = await fetch(`${BACKEND_URL}/analyze_image`, {
        method: 'POST',
        body: JSON.stringify({cursor: cursorPosition}),
        headers: {
            'Content-Type': 'application/json'
        }
    });
    return response.json();
}

const Grid = () => {

    const [messages, setMessages] = useState([]);
    const [cursor, setCursor] = useState([10,30]);
    const cursorRef = useRef(cursor);
    const gridRef = useRef(null);
    const [timer, setTimer] = useState(null);
    const [gridPrev, setGridPrev] = useState({
        grid: Array.from({length: 20}, () => Array(60).fill(-1)),
    });
    const [movements, setMovements] = useState([]);
    const movementsRef = useRef(movements);
    const [locked, setLocked] = useState(false);
    const [gridState, setGridState] = useState({});
    const [movedOnce, setMovedOnce] = useState(false);

    const handleReset = () => {
        setMovements([]);
        setMovedOnce(false);
        setLocked(true);
        // setMessages([]);
        fetch(`${BACKEND_URL}/reset`, {
            method: 'POST',
        })
        .then(data => {
            console.log("reset successful", data);
            window.location.reload();
        });
    }
    

    // fetch the grid state from the backend
    // also add the event listener for the keydown
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        // make an api call to get the grid state
        fetch(`${BACKEND_URL}/state`)
        .then(response => response.json())
        .then(data => {
            setCursor(data.cursor);
            setGridState(data);
        });
    }, []);

    // debounce function takes in a function and a timeout
    // if debounce is called again within the timeout, the timeout is reset and function is not called
    // if debounce is not called within the timeout, the function is called
    function debounce(func, timeout = 300){
        return (...args) => {
          clearTimeout(timer);
          setTimer(setTimeout(() => { func.apply(this, args); }, timeout));
        };
    }

    // handle the keydown event
    // if checks if the current cursor is in the grid
    // if it is, it adds the movement to the movements array
    // if it is not, it does nothing
    const handleKeyDown = (event) => {
        const currentCursor = cursorRef.current;
        if (event.key === 'ArrowUp') {
            if(currentCursor[0] > 0){
                setMovements((prevMovements) => ([...prevMovements, [-1,0]]));
            }
        }
        else if (event.key === 'ArrowDown') {
            if(currentCursor[0] < 19){
                setMovements((prevMovements) => ([...prevMovements, [1,0]]));
            }
        }
        else if (event.key === 'ArrowLeft') {
            if(currentCursor[1] > 0){
                setMovements((prevMovements) => ([...prevMovements, [0,-1]]));
            }
        }
        else if (event.key === 'ArrowRight') {
            if(currentCursor[1] < 59){
                setMovements((prevMovements) => ([...prevMovements, [0,1]]));
            }
        }
    }

    // handles the next movement
    // checks if new position of the cursor is in the grid - this additional check is required because the cursor updates with a lag
    // and the check within the keydown event is not reliable

    // when updating the value of the cursor, we also update the grid state
    // we also update the previous grid state
    const handleNextMovement = () => {
        const [deltaX, deltaY] = movements[0];
        const newCursor = [cursor[0] + deltaX, cursor[1] + deltaY];
        if(newCursor[0] < 0 || newCursor[0] >= 20 || newCursor[1] < 0 || newCursor[1] >= 60){
            setMovements(movements.slice(1));
            return;
        }
        // const oldCursor = cursor;
        setMovedOnce(true);
        setCursor(newCursor);

        // const prevGrid = gridPrev.grid;
        // const currentGrid = gridState.grid;
        
        // prevGrid[newCursor[0]][newCursor[1]] = currentGrid[newCursor[0]][newCursor[1]];
        // setGridPrev({grid: prevGrid});
        
        // if(prevGrid[oldCursor[0]][oldCursor[1]] === -1){
        //     if(currentGrid[oldCursor[0]][oldCursor[1]] === 1){
        //         currentGrid[oldCursor[0]][oldCursor[1]] = 0;
        //     }
        // }else{
        //     currentGrid[oldCursor[0]][oldCursor[1]] = prevGrid[oldCursor[0]][oldCursor[1]];
        // }
        // currentGrid[newCursor[0]][newCursor[1]] = 1;
        // setGridState({grid: currentGrid});

        // remove the first movement from the movements array
        setMovements(movements.slice(1));
    }

    // updates the movementsRef with the current movements
    // if a new movement is added, it calls the handleNextMovement function
    useEffect(() => {
        movementsRef.current = movements;
        if(movements.length === 0){
            return;
        }
        if(locked){
            return;
        }
        handleNextMovement();
    }, [movements]);

    // when the lock state is updated to false, starts handling the next movement
    useEffect(() => {
        if(!locked){
            if(movements.length > 0){
                handleNextMovement();
            }
        }
    }, [locked]);

    // the main logic for the grid
    // whenever the cursor is updated, it checks if the cursor is in the grid
    // then executes the logic for the grid
    useEffect(() => {
        cursorRef.current = cursor;
        console.log("cursor is", cursor)
        if(!cursor || ! gridState || ! gridState.grid){
            return;
        }
        if(locked){
            return;
        }
        if(!movedOnce){
            return;
        }
        console.log("moving ahead")
        debounce(async ()=>{
            // sleep for 3 seconds
            const currentGridState = gridRef.current;
            if(currentGridState && currentGridState.grid && currentGridState.grid[cursor[0]][cursor[1]] === 3){
                return;
            }
            setLocked(true);
            setMessages((prevMessages) => ([...prevMessages, "Locked: Taking a picture at " + cursor + "..."]));
            // mimic the process of taking a picture
            try{
                const newGridState = await takeImage(cursorRef.current);
                console.log("newGridState from backend", newGridState)
                setMessages((prevMessages) => ([...prevMessages, "Unlocked: taking a picture done"]));
                setGridPrev(newGridState);
                setGridState(newGridState);
            }catch(error){
                console.error("Error taking the picture", error);
                setLocked(false);
                return
            }
            console.log("movements after unlocking", movements)
            // how to find the latest movement state
            const currentMovements = movementsRef.current;
            // commit the grid state to the backend
            // commitGridStateToBackend(gridState);
            if(currentMovements.length > 0){
                // if any movement is made while the picture was being taken, we open the lock and return
                // then the useffect for the locked state will handle the next movement
                console.log("not committing red since movements are not empty")
                setLocked(false)
                return;
            }
            debounce(async ()=>{
                // sleep for 2 seconds
                setLocked(true);
                setMessages((prevMessages) => ([...prevMessages, "Locked: Analyzing the picture at " + cursor + "..."]));
                // mimic the process of analyzing the picture
                try{
                    const newGridState = await analyzeImage(cursorRef.current);
                    console.log("newGridState from backend", newGridState)
                    setMessages((prevMessages) => ([...prevMessages, "Unlocked: Analyzing done"]));
                    setGridPrev(newGridState);
                    setGridState(newGridState);
                }catch(error){
                    console.error("Error analyzing the picture", error);
                }
                setLocked(false);
                
                // commit the grid state to the backend
                // commitGridStateToBackend(gridState);
            }, IDLE_THRESHOLD)()
        }, IDLE_THRESHOLD)()
    }, [cursor]);

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
        return cursor[0] === cell[0] && cursor[1] === cell[1];
    }
    return <div className="main-container">
        <div className="grid-container" style={{width: GRID_WIDTH, height: GRID_HEIGHT}}>
            {gridState && gridState.grid && gridState.grid.map((row, rowIndex) => (
                <div className="grid-row" key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                        <div 
                            className={`grid-cell ${isCursorInCell(cursor, [rowIndex, cellIndex]) ? 'border-black' : ''}`}
                            key={cellIndex} 
                            style={{backgroundColor: cell === 2 ? 'green' : cell === 3 ? 'red' : 'white'}}
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