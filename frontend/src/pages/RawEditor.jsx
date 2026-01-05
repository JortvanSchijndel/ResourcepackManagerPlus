import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@heroui/react';
import { ArrowLeft, Save, FolderPlus, FilePlus, Trash2, ChevronRight, ChevronDown, File, Folder, Edit2 } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/layout/Toast';
import { api } from '../services/api';

const FileTreeItem = ({ item, level, onSelect, selectedPath, onToggle, expandedPaths, onDelete, onDrop, onSelectFolder, selectedFolder, onDragStart, onRename }) => {
    const isExpanded = expandedPaths.has(item.path);
    const isSelected = selectedPath === item.path;
    const isFolderSelected = selectedFolder === item.path;
    const paddingLeft = `${level * 1.5}rem`;

    const handleFolderClick = (e) => {
        e.stopPropagation();
        onSelectFolder(item.path);
    };

    const handleToggleClick = (e) => {
        e.stopPropagation();
        onToggle(item.path);
    };

    const handleFileClick = (e) => {
        e.stopPropagation();
        onSelect(item.path);
    };

    const handleDragStart = (e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', item.path);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(item);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.isFolder) {
            e.currentTarget.classList.add('bg-primary/10');
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('bg-primary/10');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('bg-primary/10');
        if (item.isFolder) {
            const draggedPath = e.dataTransfer.getData('text/plain');
            if (draggedPath) {
                // Internal drag and drop
                onDrop(draggedPath, item.path, true);
            } else {
                // External file drop
                onDrop(e.dataTransfer.files, item.path, false);
            }
        }
    };

    return (
        <div>
            <div
                className={`flex items-center py-1 px-2 cursor-pointer hover:bg-muted-hover group transition-colors ${
                    isSelected ? 'bg-primary/20 text-primary font-medium' : ''
                } ${isFolderSelected && item.isFolder ? 'bg-accent text-accent-foreground' : ''}`}
                style={{ paddingLeft }}
                onClick={item.isFolder ? handleFolderClick : handleFileClick}
                draggable={true}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
        <span
            className="mr-1 opacity-70 hover:text-primary transition-colors p-0.5"
            onClick={item.isFolder ? handleToggleClick : undefined}
        >
          {item.isFolder ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
              <span className="w-3.5 inline-block" />
          )}
        </span>
                <span className="mr-2 text-secondary">
          {item.isFolder ? <Folder size={16} /> : <File size={16} />}
        </span>
                <span className={`truncate flex-1 text-sm ${isSelected ? 'text-primary' : ''}`}>{item.name}</span>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRename(item.path);
                        }}
                        className="p-1 hover:bg-primary/20 hover:text-primary rounded transition-all"
                        title="Rename"
                    >
                        <Edit2 size={12} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.path, item.isFolder);
                        }}
                        className="p-1 hover:bg-danger-soft-hover hover:text-danger rounded transition-all"
                        title="Delete"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
            {item.isFolder && isExpanded && item.children && (
                <div>
                    {item.children.map((child) => (
                        <FileTreeItem
                            key={child.path}
                            item={child}
                            level={level + 1}
                            onSelect={onSelect}
                            selectedPath={selectedPath}
                            onToggle={onToggle}
                            expandedPaths={expandedPaths}
                            onDelete={onDelete}
                            onDrop={onDrop}
                            onSelectFolder={onSelectFolder}
                            selectedFolder={selectedFolder}
                            onDragStart={onDragStart}
                            onRename={onRename}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const CreateModal = ({ show, type, onClose, onSubmit }) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (show) setName('');
    }, [show]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card p-6 rounded-xl w-96 shadow-xl border border-card">
                <h3 className="text-lg font-semibold mb-4">Create New {type === 'file' ? 'File' : 'Folder'}</h3>
                <div className="mb-6">
                    <label className="block text-sm text-muted mb-1">Name</label>
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={`Enter ${type} name...`}
                        className="w-full bg-background border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onSubmit(name);
                            if (e.key === 'Escape') onClose();
                        }}
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <Button onPress={onClose} className="bg-transparent hover:bg-muted-hover text-foreground">Cancel</Button>
                    <Button onPress={() => onSubmit(name)} className="bg-primary hover:bg-primary-hover text-primary-foreground">Create</Button>
                </div>
            </div>
        </div>
    );
};

const RenameModal = ({ show, currentName, onClose, onSubmit }) => {
    const [name, setName] = useState('');

    useEffect(() => {
        if (show) setName(currentName);
    }, [show, currentName]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card p-6 rounded-xl w-96 shadow-xl border border-card">
                <h3 className="text-lg font-semibold mb-4">Rename</h3>
                <div className="mb-6">
                    <label className="block text-sm text-muted mb-1">New Name</label>
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-background border border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onSubmit(name);
                            if (e.key === 'Escape') onClose();
                        }}
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <Button onPress={onClose} className="bg-transparent hover:bg-muted-hover text-foreground">Cancel</Button>
                    <Button onPress={() => onSubmit(name)} className="bg-primary hover:bg-primary-hover text-primary-foreground">Rename</Button>
                </div>
            </div>
        </div>
    );
};

export const RawEditor = ({ onBack, currentBranch, isDark }) => {
    const [fileTree, setFileTree] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [fileContent, setFileContent] = useState('');
    const [expandedPaths, setExpandedPaths] = useState(new Set());
    const [sidebarWidth, setSidebarWidth] = useState(288); // 72 * 4 = 288px default
    const [isResizing, setIsResizing] = useState(false);
    const { message, showMessage } = useToast();
    const editorRef = useRef(null);
    const [, setDraggedItem] = useState(null);

    // Modal states
    const [createModal, setCreateModal] = useState({ show: false, type: 'file' });
    const [renameModal, setRenameModal] = useState({ show: false, currentName: '', targetPath: '' });

    useEffect(() => {
        fetchFiles();
    }, [currentBranch]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedFile, fileContent]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX;
            if (newWidth > 150 && newWidth < 600) {
                setSidebarWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const buildFileTree = (paths) => {
        const root = [];
        paths.forEach(path => {
            const isExplicitFolder = path.endsWith('/');
            const cleanPath = isExplicitFolder ? path.slice(0, -1) : path;
            const parts = cleanPath.split('/');
            let currentLevel = root;
            let currentPath = '';

            parts.forEach((part, index) => {
                if (!part) return;
                
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const isFolder = index < parts.length - 1 || (isExplicitFolder && index === parts.length - 1);

                let existingNode = currentLevel.find(node => node.name === part);

                if (!existingNode) {
                    const newNode = {
                        name: part,
                        path: currentPath,
                        isFolder,
                        children: []
                    };
                    currentLevel.push(newNode);
                    if (isFolder) {
                        currentLevel = newNode.children;
                    }
                } else {
                    if (isFolder) {
                        if (!existingNode.isFolder) {
                            existingNode.isFolder = true;
                        }
                        currentLevel = existingNode.children;
                    }
                }
            });
        });

        // Sort: folders first, then files
        const sortNodes = (nodes) => {
            nodes.sort((a, b) => {
                if (a.isFolder === b.isFolder) {
                    return a.name.localeCompare(b.name);
                }
                return a.isFolder ? -1 : 1;
            });
            nodes.forEach(node => {
                if (node.children) sortNodes(node.children);
            });
        };

        sortNodes(root);
        return root;
    };

    const fetchFiles = async () => {
        try {
            const data = await api.listFiles(currentBranch);
            const tree = buildFileTree(data.files || []);
            setFileTree(tree);
        } catch (error) {
            console.error('Error fetching files:', error);
            showMessage('Failed to load file list', 'error');
        }
    };

    const handleFileSelect = async (path) => {
        if (selectedFile === path) return;

        try {
            const data = await api.getFileContent(currentBranch, path);

            if (data.error) {
                showMessage(data.error, 'error');
                return;
            }

            setFileContent(data.content);
            setSelectedFile(path);
            // Also select the parent folder
            const parts = path.split('/');
            parts.pop();
            setSelectedFolder(parts.join('/'));
        } catch (error) {
            console.error('Error fetching file content:', error);
            showMessage('Failed to load file content', 'error');
        }
    };

    const handleFolderSelect = (path) => {
        setSelectedFolder(path);
        // Auto expand when selecting
        setExpandedPaths(prev => new Set(prev).add(path));
    };

    const handleToggleFolder = (path) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (!selectedFile) return;

        try {
            const result = await api.saveFileContent(currentBranch, selectedFile, fileContent);
            if (result.success) {
                showMessage('File saved successfully');
            } else {
                showMessage(result.message || 'Failed to save file', 'error');
            }
        } catch (error) {
            console.error('Error saving file:', error);
            showMessage('Failed to save file', 'error');
        }
    };

    const handleCreateSubmit = async (name) => {
        if (!name) return;

        const parentPath = selectedFolder || '';
        const fullPath = parentPath ? `${parentPath}/${name}` : name;

        try {
            const result = await api.createFileOrFolder(currentBranch, fullPath, createModal.type === 'folder');
            if (result.success) {
                showMessage(result.message);
                fetchFiles();
                if (parentPath) {
                    setExpandedPaths(prev => new Set(prev).add(parentPath));
                }
                setCreateModal({ ...createModal, show: false });
            } else {
                showMessage(result.message || 'Failed to create', 'error');
            }
        } catch (error) {
            console.error('Error creating:', error);
            showMessage('Failed to create', 'error');
        }
    };

    const handleRenameClick = (path) => {
        setRenameModal({
            show: true,
            currentName: path.split('/').pop(),
            targetPath: path
        });
    };

    const handleRenameSubmit = async (newName) => {
        const targetPath = renameModal.targetPath;
        if (!newName || !targetPath) return;

        const parts = targetPath.split('/');
        parts.pop();
        const parentPath = parts.join('/');
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;

        try {
            const result = await api.renameFile(currentBranch, targetPath, newPath);
            if (result.success) {
                showMessage('Renamed successfully');
                fetchFiles();
                if (selectedFile === targetPath) {
                    setSelectedFile(newPath);
                }
                if (selectedFolder === targetPath) {
                    setSelectedFolder(newPath);
                }
                setRenameModal({ ...renameModal, show: false });
            } else {
                showMessage(result.message || 'Failed to rename', 'error');
            }
        } catch (error) {
            console.error('Error renaming:', error);
            showMessage('Failed to rename', 'error');
        }
    };

    const handleDelete = async (path) => {
        if (!window.confirm(`Are you sure you want to delete ${path}?`)) return;

        try {
            const result = await api.deleteFileOrFolder(currentBranch, path);
            if (result.success) {
                showMessage('Deleted successfully');
                if (selectedFile === path) {
                    setSelectedFile(null);
                    setFileContent('');
                }
                if (selectedFolder === path) {
                    setSelectedFolder(null);
                }
                fetchFiles();
            } else {
                showMessage(result.message || 'Failed to delete', 'error');
            }
        } catch (error) {
            console.error('Error deleting:', error);
            showMessage('Failed to delete', 'error');
        }
    };

    const handleUploadFiles = async (files, targetPath) => {
        const path = targetPath || '';
        let successCount = 0;

        for (const file of files) {
            try {
                const result = await api.uploadFile(currentBranch, path, file);
                if (result.success) successCount++;
            } catch (error) {
                console.error('Upload error:', error);
            }
        }

        if (successCount > 0) {
            showMessage(`Uploaded ${successCount} files successfully`);
            fetchFiles();
            if (path) {
                setExpandedPaths(prev => new Set(prev).add(path));
            }
        } else {
            showMessage('Failed to upload files', 'error');
        }
    };

    const handleMoveFile = async (sourcePath, targetFolder) => {
        if (sourcePath === targetFolder) return;

        const fileName = sourcePath.split('/').pop();
        const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

        if (sourcePath === newPath) return;

        try {
            const result = await api.renameFile(currentBranch, sourcePath, newPath);
            if (result.success) {
                showMessage('Moved successfully');
                fetchFiles();
                if (selectedFile === sourcePath) {
                    setSelectedFile(newPath);
                }
                if (targetFolder) {
                    setExpandedPaths(prev => new Set(prev).add(targetFolder));
                }
            } else {
                showMessage(result.message || 'Failed to move', 'error');
            }
        } catch (error) {
            console.error('Error moving:', error);
            showMessage('Failed to move', 'error');
        }
    };

    const handleDrop = (data, targetPath, isInternal) => {
        if (isInternal) {
            handleMoveFile(data, targetPath);
        } else {
            handleUploadFiles(Array.from(data), targetPath);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-background text-foreground">
            <div className="bg-card border-b border-card px-4 py-3 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Button onPress={onBack} className="bg-transparent hover:bg-muted-hover text-foreground p-2 rounded-full">
                        <ArrowLeft size={20} />
                    </Button>
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-semibold">Raw Editor</h1>
                        {selectedFile && (
                            <div
                                className="flex items-center gap-2 px-3 py-1 bg-accent rounded-full text-sm cursor-pointer hover:bg-accent/80 transition-colors"
                                onClick={() => handleRenameClick(selectedFile)}
                            >
                                <span className="text-muted-foreground">{selectedFile}</span>
                                <Edit2 size={12} className="text-muted-foreground" />
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted mr-4 hidden md:inline">Ctrl+S to save</span>
                    <Button
                        onPress={handleSave}
                        disabled={!selectedFile}
                        className="bg-primary hover:bg-primary-hover text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                        <Save size={18} />
                        Save
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <div
                    className="bg-card border-r border-card flex flex-col relative"
                    style={{ width: sidebarWidth }}
                >
                    <div className="p-2 border-b border-card flex gap-2">
                        <Button
                            onPress={() => setCreateModal({ show: true, type: 'file' })}
                            className="flex-1 bg-secondary/10 hover:bg-secondary/20 text-secondary text-xs py-1.5 rounded flex items-center justify-center gap-1"
                        >
                            <FilePlus size={14} /> New File
                        </Button>
                        <Button
                            onPress={() => setCreateModal({ show: true, type: 'folder' })}
                            className="flex-1 bg-secondary/10 hover:bg-secondary/20 text-secondary text-xs py-1.5 rounded flex items-center justify-center gap-1"
                        >
                            <FolderPlus size={14} /> New Folder
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {fileTree.map((item) => (
                            <FileTreeItem
                                key={item.path}
                                item={item}
                                level={0}
                                onSelect={handleFileSelect}
                                selectedPath={selectedFile}
                                onToggle={handleToggleFolder}
                                expandedPaths={expandedPaths}
                                onDelete={handleDelete}
                                onDrop={handleDrop}
                                onSelectFolder={handleFolderSelect}
                                selectedFolder={selectedFolder}
                                onDragStart={setDraggedItem}
                                onRename={handleRenameClick}
                            />
                        ))}
                    </div>

                    {/* Resizer handle */}
                    <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-10"
                        onMouseDown={() => setIsResizing(true)}
                    />
                </div>

                <div className={`flex-1 ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
                    {selectedFile ? (
                        <Editor
                            height="100%"
                            defaultLanguage="json"
                            path={selectedFile}
                            value={fileContent}
                            onChange={(value) => setFileContent(value)}
                            onMount={(editor) => { editorRef.current = editor; }}
                            theme={isDark ? "vs-dark" : "light"}
                            options={{
                                minimap: { enabled: true },
                                fontSize: 14,
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                readOnly: false
                            }}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted flex-col gap-2">
                            <File size={48} className="opacity-20" />
                            <p>Select a file to edit</p>
                        </div>
                    )}
                </div>
            </div>

            <CreateModal
                {...createModal}
                onClose={() => setCreateModal({ ...createModal, show: false })}
                onSubmit={handleCreateSubmit}
            />

            <RenameModal
                {...renameModal}
                onClose={() => setRenameModal({ ...renameModal, show: false })}
                onSubmit={handleRenameSubmit}
            />

            <Toast message={message} />
        </div>
    );
};