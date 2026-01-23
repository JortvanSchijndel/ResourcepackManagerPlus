import React from 'react';
import { Dropdown, Button } from '@heroui/react';
import { Sun, Moon, Settings, LogOut, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const TopBar = ({
  branches,
  currentBranch,
  onBranchChange,
  onNewBranch,
  onDeleteBranch,
  isDark,
  onToggleTheme,
  onLogout
}) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleUserMenuAction = (key) => {
    if (key === 'settings') {
      navigate('/settings');
    } else if (key === 'logout') {
      onLogout && onLogout();
    }
  };

  return (
    <div className="bg-card border-b border-default px-6 py-3 flex justify-between items-center sticky top-0 z-100 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-lg font-bold text-primary-foreground bg-linear-to-r from-cyan-500 to-blue-500">
          RP
        </div>
        <div>
          <h1 className="text-base font-semibold flex items-center gap-2 text-foreground">
            Resource Pack Manager
          </h1>
          <p className="text-xs text-muted">v1.0</p>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <Button variant="ghost" size="icon" onPress={onToggleTheme} className="bg-(--secondary) hover:bg-muted">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        {currentBranch && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Branch:</span>
            <Dropdown>
              <Dropdown.Trigger>
                <div className="min-w-40 justify-between border border-default hover:bg-muted-hover-hover bg-muted rounded-lg px-3 py-2 text-sm transition-all flex items-center gap-2 cursor-pointer">
                  <span>{currentBranch}</span>
                  <ChevronsUpDown size={14} className="text-muted" />
                </div>
              </Dropdown.Trigger>
              <Dropdown.Popover className="w-[--trigger-width]">
                <Dropdown.Menu 
                  onAction={(key) => onBranchChange && onBranchChange(key)} 
                >
                  {branches && branches.map((b) => (
                    <Dropdown.Item id={b} key={b}>
                      {b}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>
        )}

        {isAdmin && onNewBranch && (
          <Button onPress={onNewBranch} className="bg-secondary rounded-lg hover:bg-secondary-hover text-secondary-foreground">
            + New Branch
          </Button>
        )}

        {isAdmin && currentBranch && !['dev', 'prod'].includes(currentBranch) && onDeleteBranch && (
          <Button
            variant="danger"
            onPress={() => onDeleteBranch(currentBranch)}
          >
            Delete Branch
          </Button>
        )}

        <Dropdown>
          <Dropdown.Trigger>
            <div className="bg-muted hover:bg-muted-hover text-foreground rounded-lg px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 cursor-pointer">
              <span>{user?.username}</span>
              <ChevronsUpDown size={14} className="text-muted" />
            </div>
          </Dropdown.Trigger>
          <Dropdown.Popover className="w-[--trigger-width]">
            <Dropdown.Menu onAction={handleUserMenuAction}>
              <Dropdown.Item id="settings" textValue="Settings">
                <Settings size={14} />
                <span>Settings</span>
              </Dropdown.Item>
              <Dropdown.Item id="logout" textValue="Logout" className="text-danger">
                <LogOut size={14} />
                <span>Logout</span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </div>
  );
};