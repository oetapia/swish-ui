import React, { useState, useRef } from 'react';
import AlbumArt from './ArtMulti';


const DraggableList = ({ onMove, items, setItems, localhost, token, volumioSocketCmd,editable, setMessage }) => {


  const [draggedItem, setDraggedItem] = useState(null);
  

  const dragButtonRef = useRef(null);

  const handleDragStart = (e, item, index) => {
    const listItem = e.target.closest('li');
    if (listItem) {
      listItem.draggable = true;
    }
    
    setDraggedItem({ ...item, currentIndex: index });
    e.dataTransfer.effectAllowed = 'move';
    
    if (listItem) {
      listItem.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e) => {
    const listItem = e.target.closest('li');
    if (listItem) {
      listItem.draggable = false;
      listItem.style.opacity = '1';
    }
    setDraggedItem(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetItem, targetIndex) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.uri === targetItem.uri) return;

    // Get the original index from the stored draggedItem
    const draggedIndex = draggedItem.currentIndex;

    // Trigger the moveQueue function with from and to indices
    // New version
    onMove("moveQueue", { 
      from: draggedIndex,
      to: targetIndex 
    });

    // Update local state
    const newItems = [...items];
    newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);
    setItems(newItems);
  };

  return (
    
      <ul className={`editable-list ${editable? "editable":""}` }>
        {items && items.length && items.map((item, index) => (
          <li
            key={item.uri+index}
            onDragStart={(e) => handleDragStart(e, item, index)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, item, index)}
            className={`
                list-item
              ${draggedItem?.uri === item.uri ? 'opacity-50' : 'opacity-100'}
            `}
          >
            
              <AlbumArt
                meta={item}
                key={item.uri}
                index={index}
                type="small"
                localhost={localhost}
                token={token}
                volumioSocketCmd={volumioSocketCmd}
                setMessage={setMessage}
              />
              
              <button 
                ref={dragButtonRef}
                onMouseDown={(e) => {
                  const listItem = e.target.closest('li');
                  if (listItem) {
                    listItem.draggable = true;
                  }
                }}
                onMouseUp={(e) => {
                  const listItem = e.target.closest('li');
                  if (listItem) {
                    listItem.draggable = false;
                  }
                }}
                className="editable-icon"
                aria-label="Drag handle"
              >
                <img
                  src="/icons/icon-drag.svg"
                  alt="Drag Item"
                  className="action"
                  width={16}
                  height={16}
                />
              </button>
            
          </li>
        ))}
      </ul>
  );
};

export default DraggableList;