'use client';

import { useState, useEffect, useRef} from 'react';
import { Button } from '@/components/ui/button';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation'; // <-- Імпортуємо useRouter

export default function SchemaEditor() {
  const router = useRouter(); // <-- Ініціалізуємо useRouter

  const [tables, setTables] = useState([]);
  const [editingTableId, setEditingTableId] = useState(null);
  const [editingColumn, setEditingColumn] = useState({ tableId: null, colIndex: null, field: null });
  const containerRef = useRef(null);

  // Використовуємо useEffect для завантаження даних з localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTables = localStorage.getItem('tables');
      if (savedTables) {
        setTables(JSON.parse(savedTables));
      }
    }
  }, []);

  const addTable = () => {
    const newTable = {
      id: uuidv4(),
      name: 'New table',
      columns: [{ name: 'id', type: 'VARCHAR' }, { name: 'name', type: 'VARCHAR' }],
      x: 200 + Math.random() * 200,
      y: 100 + Math.random() * 200,
    };
    setTables([...tables, newTable]);
  };

  const saveTables = () => {
    localStorage.setItem('tables', JSON.stringify(tables));
    alert('Tables saved!');
  };

  const deleteTable = id => {
    setTables(prev => prev.filter(t => t.id !== id));
    if (editingTableId === id) setEditingTableId(null);
  };

  const startEditingTableName = id => setEditingTableId(id);

  const changeTableName = (id, newName) => {
    setTables(prev =>
      prev.map(t => (t.id === id ? { ...t, name: newName } : t))
    );
  };

  const finishEditingTableName = () => setEditingTableId(null);

  const startEditingColumn = (tableId, colIndex, field) => {
    setEditingColumn({ tableId, colIndex, field });
  };

  const changeColumnName = (tableId, colIndex, newName) => {
    setTables(prev =>
      prev.map(t => {
        if (t.id === tableId) {
          const newCols = [...t.columns];
          newCols[colIndex] = { ...newCols[colIndex], name: newName };
          return { ...t, columns: newCols };
        }
        return t;
      })
    );
  };

  const changeColumnType = (tableId, colIndex, newType) => {
    setTables(prev =>
      prev.map(t => {
        if (t.id === tableId) {
          const newCols = [...t.columns];
          newCols[colIndex] = { ...newCols[colIndex], type: newType };
          return { ...t, columns: newCols };
        }
        return t;
      })
    );
  };

  const finishEditingColumn = () => setEditingColumn({ tableId: null, colIndex: null, field: null });

  const addColumn = tableId => {
    setTables(prev =>
      prev.map(t =>
        t.id === tableId ? { ...t, columns: [...t.columns, { name: 'new_column', type: 'VARCHAR' }] } : t
      )
    );
  };

  const deleteColumn = (tableId, colIndex) => {
    setTables(prev =>
      prev.map(t => {
        if (t.id === tableId) {
          const newCols = [...t.columns];
          newCols.splice(colIndex, 1);
          return { ...t, columns: newCols };
        }
        return t;
      })
    );

    if (editingColumn.tableId === tableId && editingColumn.colIndex === colIndex) {
      finishEditingColumn();
    }
  };

  const dragInfo = useRef({ dragging: false, tableId: null, startX: 0, startY: 0 });

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragInfo.current.dragging) return;
      const { tableId, startX, startY } = dragInfo.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      dragInfo.current.startX = e.clientX;
      dragInfo.current.startY = e.clientY;
      setTables(prev =>
        prev.map(t => (t.id === tableId ? { ...t, x: t.x + dx, y: t.y + dy } : t))
      );
    }

    function onMouseUp() {
      dragInfo.current.dragging = false;
      dragInfo.current.tableId = null;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onDragStart = (tableId, clientX, clientY) => {
    dragInfo.current = {
      dragging: true,
      tableId,
      startX: clientX,
      startY: clientY,
    };
  };

  // Функція для повернення на головну сторінку
  const handleGoBack = () => {
    router.push('/');
  };

  return (
    <div className="relative h-screen bg-gray-100 overflow-hidden" ref={containerRef}>
      <div className="p-4 flex gap-2">
        <Button onClick={addTable}>Add Table</Button>
        <Button onClick={saveTables}>Save</Button>
        <Button onClick={handleGoBack}>Back</Button>
      </div>

      <div className="relative w-full h-full">
        {tables.map(table => (
          <DraggableTable
            key={table.id}
            table={table}
            editingTableId={editingTableId}
            startEditingTableName={startEditingTableName}
            changeTableName={changeTableName}
            finishEditingTableName={finishEditingTableName}
            editingColumn={editingColumn}
            startEditingColumn={startEditingColumn}
            changeColumnName={changeColumnName}
            changeColumnType={changeColumnType}
            finishEditingColumn={finishEditingColumn}
            addColumn={addColumn}
            deleteColumn={deleteColumn}
            deleteTable={deleteTable}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </div>
  );
}

// DraggableTable залишається без змін, оскільки зміни стосуються SchemaEditor
function DraggableTable({
  table,
  editingTableId,
  startEditingTableName,
  changeTableName,
  finishEditingTableName,
  editingColumn,
  startEditingColumn,
  changeColumnName,
  changeColumnType,
  finishEditingColumn,
  addColumn,
  deleteColumn,
  deleteTable,
  onDragStart,
}) {
  const onMouseDown = e => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL' || e.target.tagName === 'SELECT') return;
    e.preventDefault();
    onDragStart(table.id, e.clientX, e.clientY);
  };

  const defaultDataTypes = ['VARCHAR', 'INT', 'TEXT', 'DATE', 'BOOLEAN', 'FLOAT'];

  return (
    <div
      className="absolute bg-white border rounded shadow p-2 cursor-move select-none max-w-xs z-10"
      style={{ left: table.x, top: table.y }}
      onMouseDown={onMouseDown}
    >
      <div className="flex justify-between items-center mb-2">
        {editingTableId === table.id ? (
          <input
            className="border-b w-full mr-2"
            type="text"
            value={table.name}
            autoFocus
            onChange={e => changeTableName(table.id, e.target.value)}
            onBlur={finishEditingTableName}
            onKeyDown={e => e.key === 'Enter' && finishEditingTableName()}
          />
        ) : (
          <strong
            onDoubleClick={() => startEditingTableName(table.id)}
            className="cursor-text flex-grow"
            title="Double click to edit table name"
          >
            {table.name}
          </strong>
        )}

        <button
          className="text-red-600 hover:text-red-800 ml-2"
          onClick={e => {
            e.stopPropagation();
            deleteTable(table.id);
          }}
          title="Delete table"
          type="button"
        >
          🗑️
        </button>
      </div>

      <ul className="text-sm mb-2">
        {table.columns.map((col, i) => {
          const isEditingName = editingColumn.tableId === table.id && editingColumn.colIndex === i && editingColumn.field === 'name';
          const isEditingType = editingColumn.tableId === table.id && editingColumn.colIndex === i && editingColumn.field === 'type';

          return (
            <li
              key={i}
              id={`col-${table.id}-${i}`}
              className="flex items-center gap-1"
            >
              {/* Поле для назви колонки */}
              {isEditingName ? (
                <input
                  className="border-b flex-grow mr-2"
                  type="text"
                  value={col.name}
                  autoFocus
                  onChange={e => changeColumnName(table.id, i, e.target.value)}
                  onBlur={finishEditingColumn}
                  onKeyDown={e => e.key === 'Enter' && finishEditingColumn()}
                />
              ) : (
                <span
                  onDoubleClick={() => startEditingColumn(table.id, i, 'name')}
                  className="flex-grow cursor-text"
                  title="Double click to edit column name"
                >
                  {col.name}
                </span>
              )}

              {/* Поле для типу даних */}
              {isEditingType ? (
                 <select
                    className="border-b mr-2"
                    value={col.type}
                    autoFocus
                    onChange={e => changeColumnType(table.id, i, e.target.value)}
                    onBlur={finishEditingColumn}
                    onKeyDown={e => e.key === 'Enter' && finishEditingColumn()}
                 >
                    {defaultDataTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                 </select>
              ) : (
                <span
                  onDoubleClick={() => startEditingColumn(table.id, i, 'type')}
                  className="cursor-text text-gray-500 text-xs"
                  title="Double click to edit data type"
                >
                  ({col.type})
                </span>
              )}

              <button
                className="text-red-500 hover:text-red-700"
                onMouseDown={e => {
                  e.preventDefault();
                  deleteColumn(table.id, i);
                }}
                title="Delete column"
                type="button"
              >
                &times;
              </button>
            </li>
          );
        })}
      </ul>

      <button
        className="text-blue-600 hover:text-blue-800 text-sm"
        onClick={() => addColumn(table.id)}
        type="button"
      >
        + Add column
      </button>
    </div>
  );
}