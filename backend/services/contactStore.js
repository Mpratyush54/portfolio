const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const FILE = path.join(__dirname, '..', 'data', 'contacts.json');

function readAll() {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2));
}

function create(doc) {
  const rows = readAll();
  const row = {
    _id: randomUUID(),
    ...doc,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  rows.unshift(row);
  writeAll(rows);
  return row;
}

function list() {
  return readAll().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function findById(id) {
  return readAll().find(r => r._id === id) || null;
}

function update(id, patch) {
  const rows = readAll();
  const i = rows.findIndex(r => r._id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, updatedAt: new Date().toISOString() };
  writeAll(rows);
  return rows[i];
}

module.exports = { create, list, findById, update };
