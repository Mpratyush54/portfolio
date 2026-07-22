const http = require('http');

// Start the server
const app = require('./server');
const server = app.listen(5000, () => {
    console.log('Server started on 5000');
    
    // Test projects endpoint
    http.get('http://localhost:5000/api/projects', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const projects = JSON.parse(data);
            console.log(`Total projects: ${projects.length}`);
            projects.forEach(p => {
                console.log(`  ${p._id}: ${p.title} (${p.source}) [${p.category}] feat=${p.featured ? '★' : ''}`);
            });
            server.close();
            process.exit(0);
        });
    }).on('error', (e) => {
        console.error('Request failed:', e.message);
        server.close();
        process.exit(1);
    });
});
