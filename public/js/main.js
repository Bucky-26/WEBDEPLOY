document.addEventListener('DOMContentLoaded', () => {
    const dashboardLink = document.getElementById('dashboardLink');
    const createProjectLink = document.getElementById('createProjectLink');
    const uploadFileLink = document.getElementById('uploadFileLink');
    const dashboardSection = document.getElementById('dashboardSection');
    const createProjectSection = document.getElementById('createProjectSection');
    const uploadFileSection = document.getElementById('uploadFileSection');
    const createProjectForm = document.getElementById('createProjectForm');
    const uploadFileForm = document.getElementById('uploadFileForm');
    const fileSystemSection = document.getElementById('fileSystemSection');
    const fileTree = document.getElementById('fileTree');
    const editor = ace.edit("editor");
    editor.setTheme("ace/theme/monokai");
    editor.session.setMode("ace/mode/html");

    let currentFile = '';

    // Add these constants at the top with other DOM elements
    const createFolderBtn = document.getElementById('createFolderBtn');
    const createFileBtn = document.getElementById('createFileBtn');
    const createFolderSection = document.getElementById('createFolderSection');
    const createFileSection = document.getElementById('createFileSection');

    // Add this with your other constants at the top
    const overlay = document.querySelector('.overlay');
    
    // Add close button functionality
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            createFolderSection.style.display = 'none';
            createFileSection.style.display = 'none';
            overlay.style.display = 'none';
            // Clear form inputs
            document.getElementById('folderName').value = '';
            document.getElementById('fileName').value = '';
            document.getElementById('fileContent').value = '';
        });
    });

    function showSection(section) {
        dashboardSection.style.display = 'none';
        createProjectSection.style.display = 'none';
        uploadFileSection.style.display = 'none';
        createFolderSection.style.display = 'none';
        createFileSection.style.display = 'none';
        section.style.display = 'block';
    }

    dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(dashboardSection);
    });

    createProjectLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(createProjectSection);
    });

    uploadFileLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(uploadFileSection);
    });

    createProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectName = document.getElementById('projectName').value;
        
        // Check if project exists
        const checkResponse = await fetch(`/check-project/${projectName}`);
        const checkResult = await checkResponse.json();
        
        if (checkResult.exists) {
            alert('Project name already exists. Please choose a different name.');
            return;
        }

        const response = await fetch('/create-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName })
        });
        const result = await response.json();
        alert(result.message || result.error);
        if (result.message) {
            location.reload();
        }
    });

    uploadFileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectName = document.getElementById('uploadProjectName').value;
        const file = document.getElementById('fileUpload').files[0];
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`/upload/${projectName}`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        alert(result.message || result.error);
    });

    document.querySelectorAll('.view-files').forEach(button => {
        button.addEventListener('click', async () => {
            const projectName = button.dataset.project;
            showSection(fileSystemSection);
            document.getElementById('currentProject').textContent = projectName;
            await loadFileSystem(projectName);
        });
    });

    async function loadFileSystem(projectName) {
        try {
            const response = await fetch(`/project-files/${projectName}`);
            const files = await response.json();
            
            fileTree.innerHTML = '';
            renderFileTree(files, '', projectName);
            
            document.getElementById('currentProject').textContent = projectName;
            fileSystemSection.style.display = 'block';
        } catch (error) {
            console.error('Error loading file system:', error);
        }
    }

    function renderFileTree(items, path, projectName) {
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = `file-item ${item.type}`;
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            div.appendChild(nameSpan);
            
            const actionDiv = document.createElement('div');
            actionDiv.className = 'file-actions';
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteItem(projectName, path + item.name, item.type);
            };
            actionDiv.appendChild(deleteBtn);
            
            // Move button
            const moveBtn = document.createElement('button');
            moveBtn.innerHTML = '<i class="fas fa-arrows-alt"></i>';
            moveBtn.onclick = (e) => {
                e.stopPropagation();
                initializeMove(projectName, path + item.name, item.type);
            };
            actionDiv.appendChild(moveBtn);
            
            div.appendChild(actionDiv);
            
            if (item.type === 'file') {
                div.onclick = () => handleFileClick(projectName, path + item.name);
            }
            
            fileTree.appendChild(div);
            
            if (item.type === 'directory' && item.children) {
                renderFileTree(item.children, path + item.name + '/', projectName);
            }
        });
    }

    // Update mode based on file extension
    function setEditorMode(fileName) {
        const extension = fileName.split('.').pop();
        switch (extension) {
            case 'js':
                editor.session.setMode("ace/mode/javascript");
                break;
            case 'css':
                editor.session.setMode("ace/mode/css");
                break;
            case 'html':
            default:
                editor.session.setMode("ace/mode/html");
                break;
        }
    }

    async function loadFile(projectName, filePath) {
        try {
            // Clean up the project name and file path
            const cleanProjectName = projectName.replace('projects/', '');
            const cleanPath = filePath.replace(/^projects\//, '');
            
            const response = await fetch(`/file-content/${cleanProjectName}/${cleanPath}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const content = await response.text();
            editor.setValue(content);
            editor.clearSelection();
            currentFile = cleanPath;
            setEditorMode(cleanPath);
            document.getElementById('saveFileBtn').style.display = 'inline-block';
        } catch (error) {
            console.error('Error loading file:', error);
            alert('Error loading file: ' + error.message);
        }
    }

    // Update the file tree click handler
    function handleFileClick(projectName, filePath) {
        if (filePath.endsWith('/')) return; // Skip if it's a directory
        loadFile(projectName, filePath);
    }

    document.getElementById('saveFileBtn').addEventListener('click', async () => {
        try {
            const content = editor.getValue();
            const projectName = document.getElementById('currentProject').textContent;
            const response = await fetch(`/save-file/${projectName}/${currentFile}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            alert('File saved successfully!');
        } catch (error) {
            console.error('Error saving file:', error);
            alert('Error saving file: ' + error.message);
        }
    });

    // Add event listeners for creating folders and files
    document.getElementById('createFolderForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const folderName = document.getElementById('folderName').value;
        const projectName = document.getElementById('currentProject').textContent;
        const response = await fetch(`/create-folder/${projectName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName })
        });
        const result = await response.json();
        alert(result.message || result.error);
        if (result.message) {
            await loadFileSystem(projectName);
        }
    });

    document.getElementById('createFileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileName = document.getElementById('fileName').value;
        const fileContent = document.getElementById('fileContent').value;
        const projectName = document.getElementById('currentProject').textContent;

        try {
            const response = await fetch(`/create-file/${projectName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    fileName, 
                    content: fileContent 
                })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to create file');
            }

            alert(result.message);
            await loadFileSystem(projectName);
            
            // Clear the form
            document.getElementById('fileName').value = '';
            document.getElementById('fileContent').value = '';
        } catch (error) {
            console.error('Error creating file:', error);
            alert(error.message);
        }
    });

    // Update the create buttons to show overlay
    createFolderBtn.addEventListener('click', () => {
        createFolderSection.style.display = 'block';
        createFileSection.style.display = 'none';
        overlay.style.display = 'block';
    });

    createFileBtn.addEventListener('click', () => {
        createFileSection.style.display = 'block';
        createFolderSection.style.display = 'none';
        overlay.style.display = 'block';
    });

    // Add click handler for overlay
    overlay.addEventListener('click', () => {
        createFolderSection.style.display = 'none';
        createFileSection.style.display = 'none';
        overlay.style.display = 'none';
        // Clear form inputs
        document.getElementById('folderName').value = '';
        document.getElementById('fileName').value = '';
        document.getElementById('fileContent').value = '';
    });
});

async function deleteItem(projectName, itemPath, type) {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    
    try {
        const response = await fetch(`/delete-item/${projectName}/${itemPath}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        await loadFileSystem(projectName);
    } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item: ' + error.message);
    }
}

function initializeMove(projectName, itemPath, type) {
    const destination = prompt(`Enter new path for ${type} (relative to project root):`);
    if (!destination) return;
    
    moveItem(projectName, itemPath, destination);
}

async function moveItem(projectName, sourcePath, destinationPath) {
    try {
        const response = await fetch(`/move-item/${projectName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sourcePath, destinationPath })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        await loadFileSystem(projectName);
    } catch (error) {
        console.error('Error moving item:', error);
        alert('Error moving item: ' + error.message);
    }
}
