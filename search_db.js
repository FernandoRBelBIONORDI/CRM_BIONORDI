const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbFiles = [
  path.join(__dirname, 'db', 'bionordi.db'),
  path.join(__dirname, 'crm.db')
];

for (const dbPath of dbFiles) {
  if (!fs.existsSync(dbPath)) {
    console.log(`Database not found at ${dbPath}`);
    continue;
  }
  console.log(`\nSearching database: ${dbPath}`);
  try {
    const db = new Database(dbPath);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    for (const table of tables) {
      const tableName = table.name;
      if (tableName.startsWith('sqlite_')) continue;
      
      const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all();
      for (const col of columns) {
        const colName = col.name;
        try {
          const query = `SELECT * FROM "${tableName}" WHERE "${colName}" LIKE '%director general%'`;
          const rows = db.prepare(query).all();
          if (rows.length > 0) {
            console.log(`Found in table [${tableName}], column [${colName}]: ${rows.length} rows`);
            rows.forEach(r => {
              console.log(JSON.stringify(r));
            });
          }
        } catch (err) {
          // Skip if query fails
        }
      }
    }
    db.close();
  } catch (err) {
    console.error(`Error processing ${dbPath}:`, err);
  }
}
