let editor;

document.addEventListener('DOMContentLoaded', function() {
    loadProjects();
    setupEventListeners();
    initializeCodeMirror();
    const uploadFileForm = document.getElementById('uploadFileForm');
    if (uploadFileForm) {
        setupFileUpload(uploadFileForm);
    }
});

function setupEventListeners() {
    console.log('Setting up event listeners');
    
    document.getElementById('dashboardLink').addEventListener('click', showDashboard);
    document.getElementById('createProjectLink').addEventListener('click', showCreateProjectForm);
    document.getElementById('uploadFileLink').addEventListener('click', showUploadFileSection);
    
    // Add event listeners for save and delete buttons
    document.getElementById('saveFileBtn').addEventListener('click', saveCurrentFile);
    document.getElementById('deleteFileBtn').addEventListener('click', deleteCurrentFile);
    
    // Add event listener for creating a new file
    document.getElementById('createNewFileBtn').addEventListener('click', createNewFile);

    // Add event listener for the "Back to Projects" button in the file manager
    const backToProjectsBtn = document.getElementById('backToProjectsBtn');
    if (backToProjectsBtn) {
        console.log('Adding event listener to Back to Projects button');
        backToProjectsBtn.addEventListener('click', backToProjects);
    } else {
        console.error('Back to Projects button not found');
    }
}

function showDashboard() {
    document.getElementById('projectsSection').classList.remove('hidden');
    document.getElementById('fileManagerSection').classList.add('hidden');
    document.getElementById('createProjectSection').classList.add('hidden');
}

function showCreateProjectForm() {
    document.getElementById('projectsSection').classList.add('hidden');
    document.getElementById('fileManagerSection').classList.add('hidden');
    document.getElementById('createProjectSection').classList.remove('hidden');
}

function loadProjects() {
    fetch('/api/projects')
        .then(response => response.json())
        .then(projects => {
            const projectList = document.getElementById('projectList');
            projectList.innerHTML = '';
            
            if (projects.length === 0) {
                projectList.innerHTML = '<p class="text-gray-500 italic">No projects found.</p>';
                return;
            }
            
            projects.forEach(project => {
                const projectCard = document.createElement('div');
                projectCard.className = 'bg-white rounded-lg shadow p-4 hover:shadow-md transition';
                projectCard.innerHTML = `
                    <h3 class="text-lg font-semibold mb-2">${project.name}</h3>
                    <p>Port: ${project.port}</p>
                    <div class="flex space-x-2 mt-2">
                        <button class="viewProjectBtn bg-green-500 text-white py-1 px-2 rounded text-sm hover:bg-green-600 transition">View</button>
                        <button class="manageProjectBtn bg-blue-500 text-white py-1 px-2 rounded text-sm hover:bg-blue-600 transition">Manage</button>
                    </div>
                `;
                const viewBtn = projectCard.querySelector('.viewProjectBtn');
                const manageBtn = projectCard.querySelector('.manageProjectBtn');
                viewBtn.addEventListener('click', () => viewProject(project.port));
                manageBtn.addEventListener('click', () => manageProject(project.name));
                projectList.appendChild(projectCard);
            });
        })
        .catch(error => {
            console.error('Error:', error);
            const projectList = document.getElementById('projectList');
            projectList.innerHTML = '<p class="text-red-500 font-bold">Error loading projects. Please try again.</p>';
        });
}

function createNewProject() {
    showCreateProjectForm();
}

function createProject() {
    const projectName = document.getElementById('projectName').value;
    if (!projectName) {
        alert('Please enter a project name');
        return;
    }

    fetch('/api/projects/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectName }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
        } else {
            alert('Project created successfully!');
            loadProjects();  // Reload the projects list
            document.getElementById('projectName').value = '';  // Clear the input field
            showDashboard();  // Show the dashboard after creating a project
        }
    })
    .catch(error => {
        console.error('Error creating project:', error);
        alert('Failed to create project. Please try again.');
    });
}

function manageProject(projectName) {
    document.getElementById('projectsSection').classList.add('hidden');
    document.getElementById('createProjectSection').classList.add('hidden');
    document.getElementById('fileManagerSection').classList.remove('hidden');
    document.getElementById('currentProjectName').textContent = projectName;
    loadProjectFiles(projectName);
}

function loadProjectFiles(projectName) {
    fetch(`/api/files/project-files/${projectName}`)
        .then(response => response.json())
        .then(files => {
            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '';
            
            files.forEach(file => {
                const li = document.createElement('li');
                li.className = 'bg-blue-500 text-white py-2 px-3 rounded cursor-pointer hover:bg-blue-600 transition mb-2';
                li.innerHTML = `
                    <i class="fas fa-file mr-2"></i>
                    <span>${file}</span>
                `;
                li.onclick = () => openFile(projectName, file);
                fileList.appendChild(li);
            });
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error loading project files');
        });
}

function openFile(projectName, fileName) {
    console.log(`Opening file: ${fileName} in project: ${projectName}`);
    fetch(`/api/files/file-content/${projectName}/${fileName}`)
        .then(response => {
            console.log('Response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            if (isImageFile(fileName)) {
                console.log('File is an image, returning blob');
                return response.blob();
            } else {
                console.log('File is not an image, returning text');
                return response.text();
            }
        })
        .then(content => {
            console.log('Content received, type:', typeof content);
            document.getElementById('currentProjectName').textContent = projectName;
            document.getElementById('currentFileName').textContent = fileName;
            
            const fileManagerSection = document.getElementById('fileManagerSection');
            if (fileManagerSection) {
                fileManagerSection.classList.remove('hidden');
            }
            
            let codeEditorElement = document.getElementById('codeEditor');
            let imageViewerElement = document.getElementById('imageViewer');
            
            // Create elements if they don't exist
            if (!codeEditorElement) {
                codeEditorElement = document.createElement('div');
                codeEditorElement.id = 'codeEditor';
                fileManagerSection.appendChild(codeEditorElement);
            }
            
            if (!imageViewerElement) {
                imageViewerElement = document.createElement('img');
                imageViewerElement.id = 'imageViewer';
                imageViewerElement.style.maxWidth = '100%';
                imageViewerElement.style.maxHeight = '500px';
                fileManagerSection.appendChild(imageViewerElement);
            }
            
            if (isImageFile(fileName)) {
                console.log('Displaying image');
                const imageUrl = URL.createObjectURL(content);
                imageViewerElement.src = imageUrl;
                imageViewerElement.alt = fileName;
                imageViewerElement.style.display = 'block';
                codeEditorElement.style.display = 'none';
                
                // Clear CodeMirror instance if it exists
                if (editor) {
                    editor.toTextArea();
                    editor = null;
                }
            } else {
                console.log('Displaying text in editor');
                imageViewerElement.style.display = 'none';
                codeEditorElement.style.display = 'block';
                
                if (!editor) {
                    console.log('Initializing CodeMirror');
                    initializeCodeMirror();
                }
                
                editor.setValue(content);
                editor.clearHistory();
                
                const fileExtension = fileName.split('.').pop().toLowerCase();
                let mode = 'text/plain';
                if (fileExtension === 'js') mode = 'javascript';
                else if (fileExtension === 'html') mode = 'htmlmixed';
                else if (fileExtension === 'css') mode = 'css';
                editor.setOption('mode', mode);

                setTimeout(() => editor.refresh(), 0);
            }
        })
        .catch(error => {
            console.error('Error opening file:', error);
            alert(`Error opening file: ${error.message}`);
        });
}

function saveCurrentFile() {
    if (!editor) {
        console.error('CodeMirror editor not initialized');
        alert('Unable to save: Editor not initialized');
        return;
    }

    console.log('saveCurrentFile function called');
    
    const projectName = document.getElementById('currentProjectName').textContent;
    const fileName = document.getElementById('currentFileName').textContent;
    const content = editor.getValue();

    if (!projectName || !fileName) {
        console.error('Project name or file name is missing');
        alert('Unable to save: Project name or file name is missing');
        return;
    }

    const url = `/api/files/write/${encodeURIComponent(projectName)}/${encodeURIComponent(fileName)}`;
    console.log(`Attempting to save file to: ${url}`);

    saveCooldown = true;
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('File saved successfully:', data);
        alert('File saved successfully!');
    })
    .catch(error => {
        console.error('Error saving file:', error);
        alert('Error saving file: ' + error.message);
    });
}

function deleteCurrentFile() {
    const projectName = document.getElementById('currentProjectName').textContent;
    const fileName = document.getElementById('currentFileName').textContent;

    if (confirm(`Are you sure you want to delete ${fileName}?`)) {
        fetch(`/api/files/${projectName}/${fileName}`, {
            method: 'DELETE',
        })
        .then(response => response.json())
        .then(data => {
            console.log('File deleted successfully:', data);
            // Refresh the file list and clear the editor
            loadFileList(projectName);
            editor.setValue('');
            document.getElementById('currentFileName').textContent = '';
        })
        .catch(error => console.error('Error deleting file:', error));
    }
}

function loadFileList(projectName) {
    fetch(`/api/files/${projectName}`)
        .then(response => response.json())
        .then(files => {
            const fileList = document.getElementById('fileList');
            fileList.innerHTML = '';
            files.forEach(file => {
                const li = document.createElement('li');
                li.textContent = file;
                li.onclick = () => openFile(projectName, file);
                fileList.appendChild(li);
            });
        })
        .catch(error => console.error('Error loading file list:', error));
}

function createNewFile() {
    const projectName = document.getElementById('currentProjectName').textContent;
    const fileName = prompt('Enter the new file name:');
    if (fileName) {
        fetch(`/api/files/create/${projectName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileName, content: '' }),
        })
        .then(response => response.json())
        .then(data => {
            alert('File created successfully');
            loadProjectFiles(projectName);  // Reload the file list
            openFile(projectName, fileName);  // Open the new file
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error creating file');
        });
    }
}

function backToProjects() {
    console.log('backToProjects function called');
    
    const projectsSection = document.getElementById('projectsSection');
    const fileManagerSection = document.getElementById('fileManagerSection');
    const createProjectSection = document.getElementById('createProjectSection');
    
    if (!projectsSection || !fileManagerSection || !createProjectSection) {
        console.error('One or more sections not found');
        return;
    }
    
    console.log('Before: projectsSection hidden:', projectsSection.classList.contains('hidden'));
    console.log('Before: fileManagerSection hidden:', fileManagerSection.classList.contains('hidden'));
    
    projectsSection.classList.remove('hidden');
    fileManagerSection.classList.add('hidden');
    createProjectSection.classList.add('hidden');
    
    console.log('After: projectsSection hidden:', projectsSection.classList.contains('hidden'));
    console.log('After: fileManagerSection hidden:', fileManagerSection.classList.contains('hidden'));
    
    // Clear the current file and project name
    const currentProjectName = document.getElementById('currentProjectName');
    const currentFileName = document.getElementById('currentFileName');
    if (currentProjectName) currentProjectName.textContent = '';
    if (currentFileName) currentFileName.textContent = '';
    
    // Clear the editor content if it exists
    if (editor) {
        editor.setValue('');
    }

    loadProjects();
}

function initializeCodeMirror() {
    const codeEditorElement = document.getElementById('codeEditor');
    if (!codeEditorElement) {
        console.error('Code editor element not found');
        return;
    }

    editor = CodeMirror(codeEditorElement, {
        lineNumbers: true,
        mode: 'htmlmixed',
        theme: 'monokai',
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        lineWrapping: true,
        extraKeys: {"Ctrl-Space": "autocomplete"}
    });

    editor.setSize("100%", "400px"); // Set a fixed height or adjust as needed
    setTimeout(() => editor.refresh(), 0);
}

function viewProject(port) {
    const hostname = window.location.hostname;
    const url = `http://${hostname}:${port}`;
    window.open(url, '_blank');
}

function toggleFileManager(show) {
    const fileManagerSection = document.getElementById('fileManagerSection');
    if (fileManagerSection) {
        fileManagerSection.style.display = show ? 'block' : 'none';
    }
}

// Remove or comment out the hideEditor function as it's no longer needed
// function hideEditor() { ... }

document.addEventListener('DOMContentLoaded', function() {
    const saveFileBtn = document.getElementById('saveFileBtn');
    if (saveFileBtn) {
        saveFileBtn.addEventListener('click', saveCurrentFile);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const backToProjectsBtn = document.getElementById('backToProjectsBtn');
    if (backToProjectsBtn) {
        console.log('Adding event listener to Back to Projects button');
        backToProjectsBtn.addEventListener('click', backToProjects);
    } else {
        console.error('Back to Projects button not found');
    }
});

function showUploadFileSection() {
    document.getElementById('projectsSection').classList.add('hidden');
    document.getElementById('fileManagerSection').classList.add('hidden');
    document.getElementById('createProjectSection').classList.add('hidden');
    document.getElementById('uploadFileSection').classList.remove('hidden');
    populateProjectSelect();
}

function populateProjectSelect() {
    fetch('/api/projects')
        .then(response => response.json())
        .then(projects => {
            const projectSelect = document.getElementById('projectSelect');
            projectSelect.innerHTML = '';
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.name;
                option.textContent = project.name;
                projectSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error loading projects:', error));
}

// Update the setupFileUpload function
function setupFileUpload(uploadFileForm) {
    uploadFileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const projectSelect = document.getElementById('projectSelect');
        const fileInput = document.getElementById('fileUpload');
        const submitButton = uploadFileForm.querySelector('button[type="submit"]');
        const uploadProgress = document.getElementById('uploadProgress');
        
        if (!projectSelect || !fileInput) {
            alert('Required form elements are missing.');
            return;
        }

        const projectName = projectSelect.value;
        const file = fileInput.files[0];

        if (!projectName) {
            alert('Please select a project.');
            return;
        }

        if (!file) {
            alert('Please select a file to upload.');
            return;
        }

        console.log('Uploading file:', file.name, 'to project:', projectName);

        // Disable submit button and show progress indicator
        submitButton.disabled = true;
        uploadProgress.classList.remove('hidden');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`/api/files/upload/${encodeURIComponent(projectName)}`, {
                method: 'POST',
                body: formData,
                // Don't set Content-Type here, let the browser set it automatically for FormData
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            let result;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf(" multipart/form-data") !== -1) {
                result = await response.json();
            } else {
                // If the response is not JSON, treat it as text
                const text = await response.text();
                console.log('Non-JSON response:', text);
                result = { error: text };
            }

            if (response.ok) {
                console.log('Upload successful:', result);
                alert(result.message || 'File uploaded successfully!');
                uploadFileForm.reset();
                // Reload file list if we're in file manager view
                if (!document.getElementById('fileManagerSection').classList.contains('hidden')) {
                    loadProjectFiles(projectName);
                }
            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert(`Upload failed: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            uploadProgress.classList.add('hidden');
        }
    });
}
// Initialize the file upload setup when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const uploadFileForm = document.getElementById('uploadFileForm');
    if (uploadFileForm) {
        setupFileUpload(uploadFileForm);
    }
});

function isImageFile(fileName) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
    const extension = fileName.split('.').pop().toLowerCase();
    return imageExtensions.includes(extension);
}

