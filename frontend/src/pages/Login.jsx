import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config/constants';
import { Button, Input, Label, TextField } from "@heroui/react";

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [brandName, setBrandName] = useState('Resource Pack Manager');
  const [brandIconUrl, setBrandIconUrl] = useState(null);

  useEffect(() => {
    let mounted = true;
    const fetchBranding = async () => {
      try {
        const res = await fetch(`${API_URL}/branding`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (data?.name) setBrandName(data.name);
        if (data?.icon_url) setBrandIconUrl(data.icon_url);
      } catch (e) {
        // ignore
      }
    };
    fetchBranding();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/');
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-card rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          {brandIconUrl && <div className="mx-auto w-16 h-16 rounded overflow-hidden mb-4"><img src={brandIconUrl} alt={brandName || 'App icon'} className="w-full h-full object-cover" /></div>}
          <h1 className="text-2xl font-bold text-foreground">{brandName || 'Resource Pack Manager'}</h1>
          <p className="text-secondary text-sm mt-2">Please sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger-soft-hover text-danger text-sm p-3 rounded-lg">
              {error}
            </div>
          )}
          
          <TextField>
            <Label className="text-sm font-medium text-secondary">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your username"
              className="w-full"
            />
          </TextField>
          
          <TextField>
            <Label className="text-sm font-medium text-secondary">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="w-full"
            />
          </TextField>
          
          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground py-2.5 rounded-lg font-medium transition-colors" 
            isDisabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
