import React from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@heroui/react';
import { Search, Check, FileCode, GitMerge, Upload, Download, ChevronsUpDown, Server } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export const Toolbar = ({
  searchQuery,
  onSearchChange,
  filterCategory,
  onFilterCategoryChange,
  filterTags,
  onFilterTagsChange,
  categories,
  tags,
  onUpload,
  onDownloadPack,
  onMerge,
  onRawEditor,
  onPush,
}) => {
  const { isAdmin } = useAuth();

  return (
    <div className="bg-card rounded-xl p-6 mb-6 border border-card flex justify-between items-center flex-wrap gap-4 transition-colors">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative min-w-75">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary w-4 h-4 z-10" />
          <input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-accent border border-default rounded-lg pl-10 pr-3 py-2.5 text-sm placeholder-text-muted text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <div className="border border-default hover:bg-muted-hover rounded-lg px-3 py-2.5 text-sm cursor-pointer min-w-37.5 text-left justify-between transition-all flex items-center gap-2">
              <span>{filterCategory || 'All Categories'}</span>
              <ChevronsUpDown size={14} className="text-muted" />
            </div>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content className="w-[--trigger-width] bg-popover rounded-lg max-h-75 overflow-y-auto shadow-lg border border-popover-border p-1">
            <DropdownMenu.Item onSelect={() => onFilterCategoryChange('')} className="text-foreground hover:bg-accent px-3 py-2 transition-colors rounded cursor-pointer flex justify-between items-center">
              <span>All Categories</span>
              {!filterCategory && <Check size={14} className="text-primary" />}
            </DropdownMenu.Item>
            {categories.map((c) => (
              <DropdownMenu.Item key={c} onSelect={() => onFilterCategoryChange(c)} className="text-foreground hover:bg-accent px-3 py-2 transition-colors rounded cursor-pointer flex justify-between items-center">
                <span>{c}</span>
                {filterCategory === c && <Check size={14} className="text-primary" />}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <div className="text-foreground border border-default rounded-lg px-3 py-2.5 text-sm cursor-pointer min-w-37.5 text-left justify-between transition-all flex items-center gap-2">
              <span>{filterTags.length > 0 ? `${filterTags.length} Selected` : 'All Tags'}</span>
              <ChevronsUpDown size={14} className="text-muted" />
            </div>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content className="w-[--trigger-width] bg-popover rounded-lg max-h-75 overflow-y-auto shadow-lg border border-popover-border p-1">
            {tags && tags.map((t) => (
              <DropdownMenu.CheckboxItem
                key={t.id}
                checked={filterTags.includes(t.id)}
                onCheckedChange={(checked) => {
                  const newTags = checked ? [...filterTags, t.id] : filterTags.filter((tagId) => tagId !== t.id);
                  onFilterTagsChange(newTags);
                }}
                className="text-foreground hover:bg-accent px-3 py-2 transition-colors rounded cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-default"
                    style={{ backgroundColor: t.color }}
                  />
                  <span>{t.tag || t.name}</span>
                </div>
                <DropdownMenu.ItemIndicator>
                  <Check size={14} className="text-primary" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.CheckboxItem>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <Button
          onPress={onRawEditor}
          className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap bg-secondary hover:bg-secondary-hover text-secondary-foreground"
        >
          <FileCode size={18} />
          Raw Editor
        </Button>

        <Button
          onPress={onUpload}
          className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap bg-success hover:bg-success-hover text-success-foreground"
        >
          <Upload size={18} />
          {isAdmin ? 'Upload' : 'Submit for Review'}
        </Button>

        <Button
          onPress={onDownloadPack}
          className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap bg-(--primary) hover:bg-(--primary-hover) text-primary-foreground"
        >
          <Download size={18} />
          Download Pack
        </Button>

        {isAdmin && (
          <Button
            onPress={onMerge}
            className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-primary-foreground"
          >
            <GitMerge size={18} />
            Merge
          </Button>
        )}

        {isAdmin && (
          <Button
            onPress={onPush}
            className="text-sm font-medium flex items-center gap-2 transition-all whitespace-nowrap bg-blue-500 hover:bg-blue-600 text-hover text-secondary-foreground"
          >
            <Server size={18} />
            Push to Server
          </Button>
        )}
      </div>
    </div>
  );
};