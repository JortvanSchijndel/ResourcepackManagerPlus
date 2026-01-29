import React from 'react';
import { Button, SearchField, Label, FieldError } from '@heroui/react';
import { FileCode, GitMerge, Upload, Download, Server } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { TagSelector } from '../form/TagSelector';
import { CategorySelector } from '../form/CategorySelector';

export const Toolbar = ({
  searchQuery,
  onSearchChange,
  filterCategory,
  onFilterCategoryChange,
  filterTags,
  onFilterTagsChange,
  categories,
  onUpload,
  onDownloadPack,
  onMerge,
  onRawEditor,
  onPush,
  onAddCategory,
  onDeleteCategory,
}) => {
  const { isAdmin } = useAuth();

  const displayCategories = ['All Categories', ...categories];
  const selectedCategory = filterCategory || 'All Categories';

  const handleCategoryChange = (val) => {
    onFilterCategoryChange(val === 'All Categories' ? '' : val);
  };

  return (
    <div className="p-6 mb-6 flex flex-col gap-4 transition-colors bg-(--bg-secondary) rounded-(--other-radius)">
      <div className="w-full">
        <SearchField
          value={searchQuery}
          onChange={onSearchChange}
          fullWidth
        >
          <Label className="sr-only">Search models</Label>
          <SearchField.Group className="w-full">
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search models..." />
            <SearchField.ClearButton />
          </SearchField.Group>
          <FieldError />
        </SearchField>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="min-w-37.5">
            <CategorySelector
                value={selectedCategory}
                onChange={handleCategoryChange}
                options={displayCategories}
                onAdd={onAddCategory}
                onDelete={onDeleteCategory}
                label="Filter Categories"
                allowDelete={false}
                allowAdd={isAdmin}
            />
          </div>

          <div className="min-w-37.5">
             <TagSelector
                selectedTags={filterTags}
                onChange={onFilterTagsChange}
                label="Filter Tags"
             />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button
            onPress={onRawEditor}
            className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap"
          >
            <FileCode size={18} />
            Raw Editor
          </Button>

          <Button
            onPress={onUpload}
            className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap"
          >
            <Upload size={18} />
            {isAdmin ? 'New Model' : 'Submit for Review'}
          </Button>

          <Button
            onPress={onDownloadPack}
            className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap"
          >
            <Download size={18} />
            Download Pack
          </Button>

          {isAdmin && (
            <Button
              onPress={onMerge}
              className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap"
            >
              <GitMerge size={18} />
              Merge
            </Button>
          )}

          {isAdmin && (
            <Button
              onPress={onPush}
              className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap"
            >
              <Server size={18} />
              Push to Server
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
