import React, { useState, useMemo, useEffect } from 'react';
import { api } from '../../services/api';
import { Button, Label, Modal, TextField, Input, toast } from '@heroui/react';
import { Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const AddCategoryModal = ({ show, onClose, onAdd, loading, parentCategory = '' }) => {
    const [name, setName] = useState('');

    const handleClose = () => {
        setName('');
        onClose();
    };

    const handleSubmit = async () => {
        const raw = name.trim();
        if (!raw) {
            toast.danger('Please enter a category name.');
            return;
        }
        let normalized = raw.replace(/\s+/g, '_').toLowerCase();
        if (normalized.includes('/')) {
            toast.danger('Subcategory name cannot contain slashes.');
            return;
        }
        if (!/^[a-z0-9._\-]+$/.test(normalized)) {
            toast.danger('Name may only contain letters, numbers, underscores, dashes and dots.');
            return;
        }

        const fullPath = parentCategory ? `${parentCategory}/${normalized}` : normalized;

        try {
            await onAdd(fullPath);
            handleClose();
        } catch (err) {
            console.error('Failed to add category', err);
            toast.danger(err?.message || 'Failed to add category');
        }
    };

    if (!show) return null;

    return (
        <Modal isOpen={show} onOpenChange={(isOpen) => !isOpen && handleClose()}>
            <Modal.Backdrop>
                <Modal.Container className="max-w-md">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>
                                {parentCategory ? `Add Subcategory to "${parentCategory}"` : 'Add New Category'}
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            <TextField>
                                <Label>Name</Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., summer_items"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                    autoFocus
                                />
                            </TextField>
                        </Modal.Body>
                        <Modal.Footer className="flex gap-3 pt-4">
                            <Button
                                onPress={handleSubmit}
                                isDisabled={loading}
                                className="flex-1"
                            >
                                {loading ? 'Adding...' : 'Add'}
                            </Button>
                            <Button onPress={handleClose} variant="secondary">
                                Cancel
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
};

const CategoryTree = ({ node, onSelect, selected, onAddSubcategory, onDelete, level = 0, expanded, toggleExpand, allowAdd, allowDelete }) => {
    return (
        <div style={{ paddingLeft: level > 0 ? 0 : 0 }}>
            {Object.keys(node).sort().map(key => {
                const currentNode = node[key];
                const { __children: children, __isLeaf, __fullPath } = currentNode;
                const hasChildren = Object.keys(children).length > 0;
                const isSelected = selected === __fullPath;

                return (
                    <div key={__fullPath} className="category-item group text-sm">
                        <div 
                            className={`
                                flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors
                                ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-(--bg-transparent-hover) text-(--txt-primary)'}
                            `}
                            onClick={() => onSelect(__fullPath)}
                            style={{ paddingLeft: `${level * 16 + 4}px` }}
                        >
                            <div className="flex items-center flex-1 overflow-hidden">
                                {(hasChildren || !__isLeaf) ? (
                                    <div 
                                        className="p-0.5 rounded hover:bg-(--bg-transparent-hover) mr-1 flex-shrink-0"
                                        onClick={(e) => { e.stopPropagation(); toggleExpand(__fullPath); }}
                                    >
                                        <ChevronRight 
                                            className={`w-4 h-4 transform transition-transform ${expanded[__fullPath] ? 'rotate-90' : ''} text-tertiary`}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-6 flex-shrink-0" />
                                )}
                                <span className="truncate">{key}</span>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center flex-shrink-0 gap-1">
                                {allowAdd && (
                                    <button 
                                        className="p-1 rounded hover:bg-(--bg-transparent-hover) text-primary"
                                        onClick={(e) => { e.stopPropagation(); onAddSubcategory(__fullPath); }}
                                        title="Add subcategory"
                                    >
                                        <Plus size={14} />
                                    </button>
                                )}
                                {allowDelete && __isLeaf && (
                                    <button 
                                        className="p-1 rounded hover:bg-(--bg-transparent-hover) text-danger"
                                        onClick={(e) => { e.stopPropagation(); onDelete(__fullPath); }}
                                        title="Delete category"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                        {expanded[__fullPath] && hasChildren && (
                            <CategoryTree 
                                node={children}
                                onSelect={onSelect}
                                selected={selected}
                                onAddSubcategory={onAddSubcategory}
                                onDelete={onDelete}
                                level={level + 1}
                                expanded={expanded}
                                toggleExpand={toggleExpand}
                                allowAdd={allowAdd}
                                allowDelete={allowDelete}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export const CategorySelector = ({ 
    value, 
    onChange, 
    options, 
    onAdd, 
    onDelete, 
    label, 
    className,
    allowAdd = true,
    allowDelete = true
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [addModalParent, setAddModalParent] = useState('');
    const [localOptions, setLocalOptions] = useState(options || []);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState({});
    const [isOpen, setIsOpen] = useState(false);

    const toggleExpand = (path) => {
        setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
    };

    useEffect(() => {
        setLocalOptions(Array.isArray(options) ? options.slice() : []);
    }, [options]);

    useEffect(() => {
        let mounted = true;
        const fetchCategories = async () => {
            setLoading(true);
            try {
                const res = await api.getNamespaces();
                const categories = res?.categories || res?.namespaces || [];
                if (mounted) {
                    setLocalOptions(prev => {
                        const combined = Array.from(new Set([...(prev || []), ...categories]));
                        combined.sort();
                        return combined;
                    });
                }
            } catch (e) {
                console.error("Failed to fetch categories:", e);
                // toast.danger("Could not load categories.");
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };
        fetchCategories();
        return () => { mounted = false; };
    }, []);

    const tree = useMemo(() => {
        const t = {};
        localOptions.forEach(opt => {
            if (!opt) return;
            const parts = opt.split('/');
            let node = t;
            parts.forEach((p, idx) => {
                const fullPath = parts.slice(0, idx + 1).join('/');
                if (!node[p]) {
                    node[p] = { __children: {}, __isLeaf: false, __fullPath: fullPath };
                }
                if (idx === parts.length - 1) {
                    node[p].__isLeaf = true;
                }
                node = node[p].__children;
            });
        });
        return t;
    }, [localOptions]);

    const handleAddCategory = async (fullPath) => {
        if (onAdd) {
            setLoading(true);
            try {
                const result = await onAdd(fullPath);
                if (result && result.categories) {
                    setLocalOptions(result.categories);
                } else {
                    if (!localOptions.includes(fullPath)) {
                        setLocalOptions([...localOptions, fullPath].sort());
                    }
                }
                toast.success(`Category "${fullPath}" added.`);
            } catch (e) {
                // Error toast is handled in the modal
            } finally {
                setLoading(false);
            }
        }
    };
    
    const handleDeleteCategory = async (fullPath) => {
        if (window.confirm(`Are you sure you want to delete category "${fullPath}"? This won't delete models inside it.`)) {
            if (onDelete) {
                setLoading(true);
                try {
                    const result = await onDelete(fullPath);
                    if (result && result.categories) {
                        setLocalOptions(result.categories);
                    } else {
                        setLocalOptions(localOptions.filter(opt => opt !== fullPath));
                    }
                    if (value === fullPath) {
                        onChange(''); 
                    }
                    toast.success(`Category "${fullPath}" deleted.`);
                } catch (e) {
                    toast.danger(e.message || "Failed to delete category.");
                } finally {
                    setLoading(false);
                }
            }
        }
    };

    const openAddModal = (parent = '') => {
        setAddModalParent(parent);
        setShowAddModal(true);
    };

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div className={className}>
            {label && <Label className="mb-1 text-sm font-medium text-(--txt-primary)">{label}</Label>}
            
            <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenu.Trigger asChild>
                    <button
                        className="
                            w-full min-h-10 px-3 py-2
                            border border-border rounded-lg
                            bg-(--bg-tertiary)
                            flex items-center justify-between gap-2 text-left mt-1
                            text-(--txt-primary)
                            hover:border-primary/50 transition-colors
                        "
                    >
                        <span className={!value ? "text-(--txt-tertiary)" : ""}>
                            {value || "Select category..."}
                        </span>
                        <ChevronDown size={16} className="text-tertiary" />
                    </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    className="
                        z-50 w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 p-1
                        bg-(--bg-tertiary)
                        rounded-(--radius) shadow-xl
                        text-(--txt-primary)
                        border border-border
                        max-h-80 overflow-y-auto
                        data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
                        data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
                    "
                >
                    {loading && <div className="p-2 text-center text-sm text-tertiary">Loading...</div>}
                    
                    {!loading && Object.keys(tree).length === 0 && (
                        <div className="p-4 text-center text-sm text-tertiary">No categories found</div>
                    )}

                    {!loading && (
                        <CategoryTree
                            node={tree}
                            onSelect={handleSelect}
                            selected={value}
                            onAddSubcategory={openAddModal}
                            onDelete={handleDeleteCategory}
                            expanded={expanded}
                            toggleExpand={toggleExpand}
                            allowAdd={allowAdd && !!onAdd}
                            allowDelete={allowDelete && !!onDelete}
                        />
                    )}

                    {allowAdd && !!onAdd && (
                        <>
                            <DropdownMenu.Separator className="my-1 h-px bg-muted" />
                            <DropdownMenu.Item
                                onSelect={(e) => { e.preventDefault(); openAddModal(''); }}
                                className="
                                    flex items-center gap-2
                                    px-2 py-1.5 text-sm
                                    text-primary rounded-md
                                    cursor-pointer
                                    hover:bg-(--bg-transparent-hover)
                                "
                            >
                                <Plus size={14} />
                                Add Root Category
                            </DropdownMenu.Item>
                        </>
                    )}
                </DropdownMenu.Content>
            </DropdownMenu.Root>

            <AddCategoryModal
                show={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddCategory}
                parentCategory={addModalParent}
                loading={loading}
            />
        </div>
    );
};
