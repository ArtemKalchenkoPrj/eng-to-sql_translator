'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import alasql from "../node_modules/alasql/dist/alasql";

export default function HomePage() {
  const [isLoading, setLoading] = useState(false);
  const [englishPrompt, setEnglishPrompt] = useState('');
  const [sqlCode, setSqlCode] = useState('');
  const [dbSchemas, setDbSchemas] = useState([]);
  const [csvDataByTableName, setCsvDataByTableName] = useState({});

  const [displayedTableData, setDisplayedTableData] = useState([]);
  const [displayedTableHeaders, setDisplayedTableHeaders] = useState([]);
  const [displayedTableName, setDisplayedTableName] = useState('Waiting for data to load');

  const fileInputRef = useRef(null);

  // --- Допоміжна функція для очищення назв колонок ---
  const cleanColumnName = (name) => {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_{2,}/g, '_').toLowerCase();
  };

  // Ефект для завантаження метаданих схеми з localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDbSchemas = localStorage.getItem('tables');
      if (savedDbSchemas) {
        const parsedDbSchemas = JSON.parse(savedDbSchemas);
        setDbSchemas(parsedDbSchemas);
      }
      setDisplayedTableData([]);
      setDisplayedTableHeaders([]);
      setDisplayedTableName('Waiting for data to load');
    }
  }, []);

  const executeSql = async (query) => {
    if (Object.keys(csvDataByTableName).length === 0) {
      alert('Please import CSV data files first.');
      return;
    }

    try {
      const result = await alasql.promise(query, csvDataByTableName);

      if (result && result.length > 0) {
        const newHeaders = Object.keys(result[0]);
        setDisplayedTableHeaders(newHeaders);
        setDisplayedTableData(result);
        setDisplayedTableName(`Query Result`);
        alert('Query executed successfully!');
      } else {
        setDisplayedTableHeaders([]);
        setDisplayedTableData([]);
        setDisplayedTableName('No results found');
        alert('Query executed, but no results were returned.');
      }
    } catch (error) {
      console.error("SQL query execution error using Alasql:", error);
      alert(`SQL execution error: ${error.message}\nCheck SQL syntax, table and column names (use schema-defined names).`);
      setDisplayedTableHeaders([]);
      setDisplayedTableData([]);
      setDisplayedTableName('');
    }
  };

  const handleSaveToCSV = () => {
    if (displayedTableHeaders.length === 0 || displayedTableData.length === 0) {
      alert('No data to save.');
      return;
    }

    const defaultFilename = displayedTableName
      ? displayedTableName.replace(/[^a-zA-Z0-9]/g, '_')
      : 'data';

    const filename = prompt('Enter file name (without extension):', defaultFilename);

    if (!filename) {
      return;
    }

    const csvContent = [
      displayedTableHeaders.join(','),
      ...displayedTableData.map(row =>
        displayedTableHeaders.map(header => {
          const cell = row[header] ?? '';
          const escaped = String(cell).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerate = async () => {
    console.log(isLoading)
    setLoading(true)
    console.log(isLoading)

    const sql_context = generateFullSQLWithData(dbSchemas); 
    const combinedText = "generate sql:" + englishPrompt + " | " + sql_context;

    try {
      const response = await fetch('http://localhost:5000/generate_sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: combinedText }),
      });

      const data = await response.json();

      setSqlCode(data.server_response);

    } catch (error) {
      console.error('Error:', error);
      alert(`SQL generation error: ${error.message}`);
    }
    finally{
      setLoading(false)
      console.log(isLoading)
    }
    console.log(isLoading)

  };

  const handleApply = () => {
    if (sqlCode.trim()) {
      executeSql(sqlCode);
    } else {
      alert('Please generate or enter a SQL query first.');
    }
  };

  const router = useRouter();
  const handleSchema = () => {
    router.push('/schema');
  };

  const handleAddData = () => {
    fileInputRef.current.click();
  };  

  const generateFullSQLWithData = (schema) => {
    if (!schema || schema.length === 0) {
        console.warn("Database schema is empty. SQL context generation is not possible.");
        return "";
    }

    return schema.map(table => {
      const tableName = table.name;
      const columns = table.columns.map(col => `${col.name} ${col.type}`).join(", ");
      const columnNames = table.columns.map(col => col.name);

      let sql = `CREATE TABLE ${tableName} (${columns});`;

      const tableDataForContext = csvDataByTableName[tableName];
      const firstRow = tableDataForContext && tableDataForContext.length > 0 ? tableDataForContext[0] : null;

      if (firstRow) {
        const formattedValues = columnNames.map(col => {
          const value = firstRow[col];
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
          return value;
        }).join(", ");

        sql += ` INSERT INTO ${tableName} (${columnNames.join(", ")}) VALUES (${formattedValues});`;
      }

      return sql;
    }).join(" ");
  };

  /**
   * Обробляє вибір файлу CSV та парсить його.
   * Після парсингу запитує користувача, до якої таблиці належать ці дані.
   */
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type === 'text/csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          header: (header) => cleanColumnName(header),
          complete: (results) => {
            const newData = results.data;
            const newHeaders = Object.keys(newData[0] || {});
            const suggestedName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '');
            let tableNameInput = '';

            if (dbSchemas.length > 0) {
              const availableNames = dbSchemas.map(s => s.name).join(', ');
              tableNameInput = prompt(
                `Please specify the name of the table from the database schema to which this data belongs. "${file.name}" (available: ${availableNames}):`,
                suggestedName
              );
            } else {
              tableNameInput = prompt(
                `Please specify the name of the table to which this data belongs. "${file.name}":`,
                suggestedName
              );
            }

            if (tableNameInput) {
              const cleanedTableName = tableNameInput.replace(/[^a-zA-Z0-9_]/g, '');
              const schemaMatch = dbSchemas.find(s => s.name === cleanedTableName);

              if (schemaMatch) {
                const schemaColumnNames = schemaMatch.columns.map(col => col.name.toLowerCase());
                const csvColumnNames = newHeaders.map(header => header.toLowerCase());

                const missingInCsv = schemaColumnNames.filter(name => !csvColumnNames.includes(name));
                const extraInCsv = csvColumnNames.filter(name => !schemaColumnNames.includes(name));

                if (missingInCsv.length > 0 || extraInCsv.length > 0) {
                  let warningMessage = `Warning: Columns in CSV file do not fully match table schema '${cleanedTableName}':\n`;
                  if (missingInCsv.length > 0) warningMessage += `  - Missing in CSV (from schema): ${missingInCsv.join(', ')}\n`;
                  if (extraInCsv.length > 0) warningMessage += `  - Additional in CSV (not in schema): ${extraInCsv.join(', ')}\n`;
                  alert(warningMessage + "Please check your DB schema");
                  return;
                }
              } else {
                alert(`Warning: table '${cleanedTableName}' not found in the loaded database schema. Data will not be loaded. Please check your DB schema`);
                return;
              }

              // Оновлюємо стан csvDataByTableName
              setCsvDataByTableName(prevData => ({
                ...prevData,
                [cleanedTableName]: newData,
              }));

              try {
                const tablesJson = localStorage.getItem('tables');
                if (!tablesJson) throw new Error('It seems the schema hasn\'t been created yet.');

                const loadedDbSchemas = JSON.parse(tablesJson);

                const tableSchema = loadedDbSchemas.find(t => t.name === cleanedTableName);
                if (!tableSchema) throw new Error(`Schema for table '${cleanedTableName}' not found`);

                if (alasql.tables[cleanedTableName]) {
                  alasql(`DROP TABLE ${cleanedTableName}`);
                }

                const columnDefs = tableSchema.columns
                  .map(col => `${col.name} ${col.type}`)
                  .join(', ');

                alasql(`CREATE TABLE ${cleanedTableName} (${columnDefs})`);

                // Приведення типів
                const typedData = newData.map(row => {
                  const typedRow = {};
                  tableSchema.columns.forEach(col => {
                    const rawValue = row[col.name];
                    if (col.type === 'INT' || col.type === 'FLOAT') {
                      const num = parseFloat(rawValue);
                      typedRow[col.name] = isNaN(num) ? null : num;
                    } else {
                      // Тип за замовчуванням: текст
                      typedRow[col.name] = rawValue ?? null;
                    }
                  });
                  return typedRow;
                });

                // Вставляємо типізовані дані
                typedData.forEach(row => {
                  alasql.tables[cleanedTableName].data.push(row);
                });

                const sql_context = generateFullSQLWithData(loadedDbSchemas);
                console.log(sql_context)

              } catch (err) {
                alert(`Error creating table '${cleanedTableName}' in alasql: ${err.message}`);
              }
              // Обрізання таблиці щоб не зображати
              // величезні таблиці на сторінці
              const previewRows = newData.slice(0, 30);

              setDisplayedTableHeaders(newHeaders);
              setDisplayedTableData(previewRows);
              setDisplayedTableName(`Data for: '${cleanedTableName}' from '${file.name}'`);
              alert(`File "${file.name}" successfully loaded. Data associated with table "${cleanedTableName}".`);
            } else {
              alert('No table name specified, no data loaded.');
            }
          },
          error: (error) => {
            alert(`Error parsing file: ${error.message}`);
          },
        });
      } else {
        alert('Please select a file in CSV format.');
        event.target.value = null;
      }
    }
  };


  return (
    <main className="min-h-screen p-8 bg-white">
      <div className="grid grid-cols-2 gap-6">
        {/* ЛІВА КОЛОНКА: Ввід */}
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">Enter the text</h1>
          <textarea
            placeholder="Enter an English query, for example: 'show all employees' or 'merge employees and departments'..."
            value={englishPrompt}
            onChange={(e) => setEnglishPrompt(e.target.value)}
            className="p-4 h-28 border border-gray-300 rounded-md shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            {isLoading ? "Please wait..." : "Generate"}
          </button>

          <textarea
            placeholder={`The generated SQL will appear here (use the table names from the schema: ${dbSchemas.map(t => t.name).join(', ') || 'download the schema'})...`}
            value={sqlCode}
            onChange={(e) => setSqlCode(e.target.value)}
            className="p-4 h-28 border border-gray-300 rounded-md shadow-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleApply}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
          >
            Apply
          </button>
        </div>

        {/* ПРАВА КОЛОНКА */}
        <div className="border border-gray-200 rounded-lg shadow p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-4">
            <div>
              <button
                onClick={handleSchema}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
              >
                DB Schema
              </button>
              <button
                onClick={handleAddData}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition ml-2"
              >
                Import (CSV)
              </button>
              <button
                onClick={handleSaveToCSV}
                className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition ml-2"
              >
                Export (CSV)
              </button>
            </div>
            <div className="text-gray-600 text-sm">
              <p>Loaded tables (CSV): <span className="font-semibold">{Object.keys(csvDataByTableName).join(', ') || 'Empty'}</span></p>
              <p>Shown: <span className="font-semibold">{displayedTableName || '---'}</span></p>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            style={{ display: 'none' }}
          />
          <h2 className="text-lg font-semibold mb-4 mt-4">Preview of the result / Downloaded data</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  {displayedTableHeaders.length > 0 ? (
                    displayedTableHeaders.map((header, index) => (
                      <th key={index} className="px-3 py-2 border">
                        {header}
                      </th>
                    ))
                  ) : (
                    // Початкова заглушка заголовків
                    <></>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayedTableData.length > 0 ? (
                  displayedTableData.slice(0,30).map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-100">
                      {displayedTableHeaders.map((header, colIndex) => (
                        <td key={colIndex} className="px-3 py-2 border">
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  // Повідомлення, коли немає даних
                  <tr>
                    <td colSpan={displayedTableHeaders.length || 3} className="px-3 py-2 border text-center text-gray-500">
                      1. Load the database schema (DB Schema). <br/>
                      2. Download CSV files for each table (Import (CSV)). <br/>
                      3. Enter and execute the SQL query. <br/>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}