import React, { useState, useEffect } from 'react';
import { Modal, Button, Dropdown, Label, Description } from '@heroui/react';
import { useBranches } from '../../hooks/useBranches';
import { ChevronRight, ChevronDown, AlertTriangle, FileText, Box } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const MergeModal = ({ show, branches, onClose, onSubmit, loading }) => {
  const [source, setSource] = useState('dev');
  const [target, setTarget] = useState('prod');
  const [differences, setDifferences] = useState([]);
  const [groupedDifferences, setGroupedDifferences] = useState({});
  const [selectedChanges, setSelectedChanges] = useState({});
  const [step, setStep] = useState('select'); // 'select' or 'review'
  const { compareBranches, compareFileContent } = useBranches();
  const [comparing, setComparing] = useState(false);
  const [expandedModels, setExpandedModels] = useState({});
  const [fileDiff, setFileDiff] = useState(null);
  const [viewingFile, setViewingFile] = useState(null);
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (show) {
      setStep('select');
      setDifferences([]);
      setGroupedDifferences({});
      setSelectedChanges({});
      setExpandedModels({});
      setFileDiff(null);
      setViewingFile(null);
    }
  }, [show]);

  const handleCompare = async () => {
    if (source === target) {
      alert("Source and target cannot be the same");
      return;
    }
    setComparing(true);
    const result = await compareBranches(source, target);
    setComparing(false);
    
    if (result.success) {
      setDifferences(result.differences);
      
      // Group by model
      const grouped = {};
      const otherFiles = [];
      
      result.differences.forEach(diff => {
        // Try to extract model info from path
        // Expected paths:
        // assets/<namespace>/models/item/<model_id>/...
        // assets/<namespace>/textures/item/<model_id>/...
        // assets/<namespace>/items/<model_id>.json
        
        const parts = diff.path.split('/');
        let modelKey = null;
        let modelName = null;
        
        if (parts.length >= 5 && parts[0] === 'assets' && parts[2] === 'models' && parts[3] === 'item') {
          modelKey = `${parts[1]}:${parts[4]}`;
          modelName = parts[4];
        } else if (parts.length >= 5 && parts[0] === 'assets' && parts[2] === 'textures' && parts[3] === 'item') {
          modelKey = `${parts[1]}:${parts[4]}`;
          modelName = parts[4];
        } else if (parts.length === 4 && parts[0] === 'assets' && parts[2] === 'items' && parts[3].endsWith('.json')) {
          const id = parts[3].replace('.json', '');
          modelKey = `${parts[1]}:${id}`;
          modelName = id;
        }
        
        if (modelKey) {
          if (!grouped[modelKey]) {
            grouped[modelKey] = {
              name: modelName,
              namespace: parts[1],
              files: [],
              status: 'modified' // Default, will check if all are added/deleted
            };
          }
          grouped[modelKey].files.push(diff);
        } else {
          otherFiles.push(diff);
        }
      });
      
      // Determine status for each group
      Object.keys(grouped).forEach(key => {
        const files = grouped[key].files;
        const allAdded = files.every(f => f.status === 'added');
        const allDeleted = files.every(f => f.status === 'deleted');
        
        if (allAdded) grouped[key].status = 'added';
        else if (allDeleted) grouped[key].status = 'deleted';
        else grouped[key].status = 'modified';
      });
      
      setGroupedDifferences({ models: grouped, other: otherFiles });
      
      // Select all by default
      const initialSelection = {};
      result.differences.forEach(diff => {
        initialSelection[diff.path] = true;
      });
      setSelectedChanges(initialSelection);
      
      setStep('review');
    } else {
      alert("Error comparing branches: " + result.message);
    }
  };

  const handleToggleChange = (path) => {
    setSelectedChanges(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };
  
  const handleToggleModel = (modelKey, files) => {
    const allSelected = files.every(f => selectedChanges[f.path]);
    const newSelection = { ...selectedChanges };
    
    files.forEach(f => {
      newSelection[f.path] = !allSelected;
    });
    
    setSelectedChanges(newSelection);
  };

  const toggleExpand = (key) => {
    setExpandedModels(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleViewDiff = async (path) => {
    setViewingFile(path);
    setFileDiff(null);
    const result = await compareFileContent(source, target, path);
    if (result.success) {
      setFileDiff(result);
    } else {
      alert("Error loading file diff: " + result.message);
      setViewingFile(null);
    }
  };

  const handleSubmit = () => {
    // Build operations list
    const operations = [];
    
    differences.forEach(diff => {
      if (selectedChanges[diff.path]) {
        if (diff.status === 'added' || diff.status === 'modified') {
          operations.push({ path: diff.path, action: 'copy' });
        } else if (diff.status === 'deleted') {
          operations.push({ path: diff.path, action: 'delete' });
        }
      }
    });

    if (operations.length === 0) {
      if (!window.confirm("No changes selected. Do you want to close without merging?")) {
        return;
      }
      onClose();
      return;
    }

    onSubmit(source, target, operations);
  };

  if (!show) return null;
  if (!isAdmin) return null; // Extra safety check

  return (
    <Modal isOpen={show} onOpenChange={onClose} size="4xl">
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="bg-card max-h-[90vh] flex flex-col w-full">
            <Modal.CloseTrigger className="text-tertiary hover:text-foreground" />

            <Modal.Header>
              <Modal.Heading className="text-2xl font-semibold text-foreground">
                Merge Branches
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="space-y-5 overflow-y-auto flex-1 p-6">
              {step === 'select' ? (
                <>
                  <Description className="text-secondary text-sm">
                    Select source and target branches to compare differences.
                  </Description>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="block text-sm font-medium text-secondary mb-2">
                        Source Branch
                      </Label>
                      <Dropdown>
                        <Dropdown.Trigger>
                          <Button className="w-full justify-between">
                            {source}
                          </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover className="w-(--trigger-width)">
                          <Dropdown.Menu onAction={(key) => setSource(key)}>
                            {branches.map((b) => (
                              <Dropdown.Item key={b}>
                                <Label>{b}</Label>
                              </Dropdown.Item>
                            ))}
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    </div>

                    <div>
                      <Label className="block text-sm font-medium text-secondary mb-2">
                        Target Branch
                      </Label>
                      <Dropdown>
                        <Dropdown.Trigger>
                          <Button className="w-full justify-between">
                            {target}
                          </Button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover className="w-(--trigger-width)">
                          <Dropdown.Menu onAction={(key) => setTarget(key)}>
                            {branches.map((b) => (
                              <Dropdown.Item key={b}>
                                <Label>{b}</Label>
                              </Dropdown.Item>
                            ))}
                          </Dropdown.Menu>
                        </Dropdown.Popover>
                      </Dropdown>
                    </div>
                  </div>
                </>
              ) : viewingFile ? (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Button size="sm" variant="ghost" onPress={() => setViewingFile(null)}>
                      ← Back to list
                    </Button>
                    <span className="font-mono text-sm truncate">{viewingFile}</span>
                  </div>
                  
                  {fileDiff ? (
                    <div className="flex-1 overflow-auto border border-default rounded-lg bg-canvas p-4 font-mono text-xs">
                      {fileDiff.isBinary ? (
                        <div className="text-center py-10 text-secondary">
                          Binary file (cannot show diff)
                        </div>
                      ) : (
                        <div className="whitespace-pre">
                          {fileDiff.diff.length > 0 ? (
                            fileDiff.diff.map((line, i) => (
                              <div key={i} className={
                                line.startsWith('+') ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                                line.startsWith('-') ? 'bg-red-500/20 text-red-700 dark:text-red-400' :
                                line.startsWith('@@') ? 'text-purple-500 font-bold my-2' : ''
                              }>
                                {line}
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-10 text-secondary">
                              No content changes (files identical)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-10">Loading diff...</div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <Description className="text-secondary text-sm">
                      Review changes to apply from <b>{source}</b> to <b>{target}</b>.
                    </Description>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onPress={() => setStep('select')}
                      className="text-xs"
                    >
                      Change Branches
                    </Button>
                  </div>

                  {differences.length === 0 ? (
                    <div className="text-center py-8 text-secondary">
                      No differences found between branches.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Models Section */}
                      {Object.keys(groupedDifferences.models || {}).length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-secondary mb-2 uppercase tracking-wide">Models</h3>
                          <div className="border border-default rounded-lg overflow-hidden divide-y divide-default">
                            {Object.entries(groupedDifferences.models).map(([key, group]) => {
                              const allSelected = group.files.every(f => selectedChanges[f.path]);
                              const someSelected = group.files.some(f => selectedChanges[f.path]);
                              const isExpanded = expandedModels[key];
                              
                              return (
                                <div key={key} className="bg-card">
                                  <div className="flex items-center px-4 py-3 hover:bg-muted/50 transition-colors">
                                    <button 
                                      onClick={() => toggleExpand(key)}
                                      className="mr-2 text-secondary hover:text-foreground"
                                    >
                                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                    
                                    <input 
                                      type="checkbox"
                                      checked={allSelected}
                                      ref={input => {
                                        if (input) {
                                          input.indeterminate = someSelected && !allSelected;
                                        }
                                      }}
                                      onChange={() => handleToggleModel(key, group.files)}
                                      className="mr-3 w-4 h-4 accent-purple-600 cursor-pointer"
                                    />
                                    
                                    <div className="flex-1 flex items-center gap-2 cursor-pointer" onClick={() => toggleExpand(key)}>
                                      <Box size={16} className="text-purple-500" />
                                      <span className="font-medium text-(--text-secondary)">{group.name}</span>
                                      <span className="text-xs text-(--text-tertiary)">({group.namespace})</span>
                                    </div>
                                    
                                    {group.status === 'modified' ? (
                                      <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                        <AlertTriangle size={12} />
                                        <span>Modified</span>
                                      </div>
                                    ) : (
                                      <div className={`text-xs font-bold px-2 py-1 rounded uppercase
                                        ${group.status === 'added' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                        ${group.status === 'deleted' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                                      `}>
                                        {group.status}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {isExpanded && (
                                    <div className="bg-muted/30 border-t border-default pl-12 pr-4 py-2 space-y-1">
                                      {group.files.map(file => (
                                        <div key={file.path} className="flex items-center py-1 text-sm group">
                                          <input 
                                            type="checkbox"
                                            checked={!!selectedChanges[file.path]}
                                            onChange={() => handleToggleChange(file.path)}
                                            className="mr-3 w-3 h-3 accent-purple-600 cursor-pointer"
                                          />
                                          <span className="flex-1 truncate text-secondary font-mono text-xs" title={file.path}>
                                            {file.path.split('/').pop()}
                                          </span>
                                          
                                          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase mr-2
                                            ${file.status === 'added' ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : ''}
                                            ${file.status === 'modified' ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' : ''}
                                            ${file.status === 'deleted' ? 'text-red-600 bg-red-100 dark:bg-red-900/30' : ''}
                                          `}>
                                            {file.status}
                                          </div>
                                          
                                          <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                            onPress={() => handleViewDiff(file.path)}
                                          >
                                            Diff
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Other Files Section */}
                      {groupedDifferences.other && groupedDifferences.other.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-secondary mb-2 uppercase tracking-wide mt-4">Other Files</h3>
                          <div className="border border-default rounded-lg overflow-hidden divide-y divide-default">
                            {groupedDifferences.other.map(file => (
                              <div key={file.path} className="bg-card flex items-center px-4 py-3 hover:bg-muted/50 transition-colors group">
                                <input 
                                  type="checkbox"
                                  checked={!!selectedChanges[file.path]}
                                  onChange={() => handleToggleChange(file.path)}
                                  className="mr-3 w-4 h-4 accent-purple-600 cursor-pointer"
                                />
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                  <FileText size={16} className="text-secondary" />
                                  <span className="text-sm font-medium truncate text-(--text-secondary)" title={file.path}>
                                    {file.path}
                                  </span>
                                </div>
                                
                                <div className={`text-xs font-bold px-2 py-1 rounded uppercase mr-2
                                  ${file.status === 'added' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}
                                  ${file.status === 'modified' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}
                                  ${file.status === 'deleted' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                                `}>
                                  {file.status}
                                </div>
                                
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                  onPress={() => handleViewDiff(file.path)}
                                >
                                  Diff
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-between text-xs text-secondary">
                    <span>{Object.values(selectedChanges).filter(Boolean).length} selected</span>
                    <Button 
                      size="sm" 
                      variant="light" 
                      className="h-auto p-0 text-primary"
                      onPress={() => {
                        const allSelected = Object.values(selectedChanges).every(Boolean);
                        const newSelection = {};
                        differences.forEach(d => newSelection[d.path] = !allSelected);
                        setSelectedChanges(newSelection);
                      }}
                    >
                      Toggle All
                    </Button>
                  </div>
                </>
              )}
            </Modal.Body>

            <Modal.Footer className="flex gap-3 p-6 border-t border-default">
              {step === 'select' ? (
                <>
                  <Button
                    onPress={handleCompare}
                    isDisabled={comparing || source === target}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-5 py-3 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {comparing ? 'Comparing...' : 'Compare Branches'}
                  </Button>
                </>
              ) : viewingFile ? (
                <div className="flex-1"></div>
              ) : (
                <>
                  <Button
                    onPress={handleSubmit}
                    isDisabled={loading || Object.values(selectedChanges).filter(Boolean).length === 0}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-5 py-3 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Merging...' : 'Merge Selected Changes'}
                  </Button>
                </>
              )}
              <Button
                onPress={onClose}
                className="bg-transparent border border-default text-secondary hover:bg-muted rounded-lg px-5 py-3 text-sm font-medium transition-all"
              >
                {viewingFile ? 'Close' : 'Cancel'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};