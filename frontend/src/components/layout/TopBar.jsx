import React, { useState, useEffect } from 'react';
import {Dropdown, Button, Avatar, Label, Select, ListBox, Tabs} from '@heroui/react';
import { Sun, Moon, SunMoon, ChevronsUpDown, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { API_URL } from '../../config/constants';
import { useNavigate } from 'react-router-dom';

export const TopBar = ({
  branches,
  currentBranch,
  onBranchChange,
  onNewBranch,
  onDeleteBranch,
  onLogout
}) => {
  const { user, isAdmin, themePreference, setThemePreference } = useAuth();
  const navigate = useNavigate();

  const [brandName, setBrandName] = useState('Resource Pack Manager');
  const [brandIconUrl, setBrandIconUrl] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchBranding = async () => {
    const res = await fetch(`${API_URL}/branding`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (!mounted) return;
    if (data?.name) setBrandName(data.name);
    if (data?.icon_url) setBrandIconUrl(data.icon_url);
    };
    fetchBranding();
    return () => { mounted = false; };
  }, []);

  const handleUserMenuAction = (key) => {
    if (key === 'settings') {
      navigate('/settings');
    } else if (key === 'logout') {
      onLogout && onLogout();
    }
  };

  return (
    <div className="border-b px-6 py-3 flex justify-between items-center sticky top-0 z-100 transition-colors backdrop-blur-(--blur)">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 flex items-center justify-center text-lg font-bold">
          {brandIconUrl ? (
            <img src={brandIconUrl} alt={brandName || 'App icon'} className="w-full h-full object-cover rounded" />
          ) : (
            'RP'
          )}
        </div>
        <div>
          <h1 className="text-base font-semibold flex items-center gap-2">
            {brandName || 'Resource Pack Manager'}
          </h1>
        </div>
      </div>

      <div className="flex gap-3 items-center">
        {currentBranch && (
          <div className="flex items-center gap-2">
            <span className="text-sm">Branch:</span>
            <Select
              value={currentBranch}
              onChange={onBranchChange}
              className="min-w-40"
              aria-label="Select current branch"
            >
              <Select.Trigger className="rounded-xl">
                <Select.Value />
                <Select.Indicator>
                  <ChevronsUpDown size={14} />
                </Select.Indicator>
              </Select.Trigger>
              <Select.Popover className="rounded-xl">
                <ListBox>
                  {branches && branches.map((b) => (
                    <ListBox.Item id={b} key={b}>
                      {b}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        )}

        {isAdmin && onNewBranch && (
          <Button onPress={onNewBranch}>
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
            <Avatar>
              <Avatar.Image
                alt={user?.username}
              />
              <Avatar.Fallback delayMs={200}>
                <User />
              </Avatar.Fallback>
            </Avatar>
          </Dropdown.Trigger>
          <Dropdown.Popover className="rounded-(--other-radius) backdrop-blur-(--blur) bg-transparent">
            <div className="px-3 pt-3 pb-1 ">
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <Avatar.Image
                    alt={user?.username}
                  />
                  <Avatar.Fallback delayMs={200} className="bg-(--bg-quaternary)">
                   <User size={18}/>
                  </Avatar.Fallback>
                </Avatar>
                <div className="flex flex-col gap-0">
                  <p className="text-sm leading-5 font-medium">{user?.username}</p>
                </div>
              </div>
            </div>

            <div className="px-2 py-2 w-full">
               <Tabs 
                  fullWidth 
                  aria-label="Theme"
                  selectedKey={themePreference}
                  onSelectionChange={setThemePreference}
                >
                  <Tabs.ListContainer>
                    <Tabs.List className="bg-(--bg-transparent-hover)">
                        <Tabs.Tab id="light">
                            <Sun className="size-4" />
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="dark">
                            <Moon className="size-4" />
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="system">
                            <SunMoon className="size-4" />
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
               </Tabs>
            </div>

            <Dropdown.Menu onAction={handleUserMenuAction}>
              <Dropdown.Item id="settings" textValue="Settings" className="hover:bg-(--bg-transparent-hover)">
                <div className="flex w-full items-center gap-2">
                  <Settings className="size-3.5" />
                  <Label>Settings</Label>
                </div>
              </Dropdown.Item>
              <Dropdown.Item id="logout" textValue="Logout" variant="danger" className="hover:bg-(--bg-transparent-hover)">
                <div className="flex w-full items-center gap-2">
                  <LogOut className="size-3.5 text-(--danger)" />
                  <Label>Log Out</Label>
                </div>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </div>
  );
};
