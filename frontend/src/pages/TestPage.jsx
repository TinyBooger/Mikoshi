import React from 'react';

function TestPage() {
  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar will be rendered here by your layout system */}
      
      {/* Main content area - adjust the padding/margin to match your layout */}
      <div className="flex-grow-1 p-4">
        <h1>Sidebar Test Page</h1>
        <p>This is a blank page to test the Sidebar functionality.</p>
        
        {/* Add some test content if needed */}
        <div className="mt-4 p-4 border rounded">
          <h2>Test Content</h2>
          <p>Try interacting with the Sidebar components to verify:</p>
          <ul>
            <li>Navigation links work</li>
            <li>User dropdown functions</li>
            <li>Recent characters display</li>
            <li>Login/logout states</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default TestPage;