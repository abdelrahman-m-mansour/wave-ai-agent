'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface UserProfile {
  id: string;
  name: string;
  avatarColor: string;
  avatarEmoji: string;
  pin?: string;
  createdAt: number;
}

export default function Chat() {
  // Profile state
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState<boolean>(true);
  const [profileModalMode, setProfileModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [unlockingProfile, setUnlockingProfile] = useState<UserProfile | null>(null);

  // Profile forms & security states
  const [profileName, setProfileName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🌊');
  const [selectedColor, setSelectedColor] = useState('from-blue-600 to-indigo-600');
  const [requirePin, setRequirePin] = useState(false);
  const [profilePin, setProfilePin] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Navigation & session state
  const [viewMode, setViewMode] = useState<'landing' | 'chat'>('landing');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // UI states
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [imageLoadingStates, setImageLoadingStates] = useState<{ [key: string]: boolean }>({});
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load profiles on mount
  useEffect(() => {
    try {
      const storedProfiles = localStorage.getItem('wave_ai_profiles');
      if (storedProfiles) {
        const parsedProfiles = JSON.parse(storedProfiles) as UserProfile[];
        setProfiles(parsedProfiles);
        
        const activeProfileId = localStorage.getItem('wave_ai_active_profile_id');
        if (activeProfileId) {
          const profile = parsedProfiles.find(p => p.id === activeProfileId);
          if (profile) {
            if (profile.pin) {
              setUnlockingProfile(profile);
              setShowProfileSelector(true);
            } else {
              setActiveProfile(profile);
              setShowProfileSelector(false);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load profiles', e);
    }
  }, []);

  // Load sessions when activeProfile changes
  useEffect(() => {
    if (!activeProfile) {
      setSessions([]);
      setCurrentSessionId(null);
      setViewMode('landing');
      return;
    }
    try {
      const stored = localStorage.getItem(`wave_ai_sessions_${activeProfile.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as ChatSession[];
        setSessions(parsed);
        if (parsed.length > 0) {
          const sorted = [...parsed].sort((a, b) => b.createdAt - a.createdAt);
          setCurrentSessionId(sorted[0].id);
          setViewMode('chat');
        } else {
          setCurrentSessionId(null);
          setViewMode('landing');
        }
      } else {
        setSessions([]);
        setCurrentSessionId(null);
        setViewMode('landing');
      }
    } catch (e) {
      console.error(`Failed to load sessions for profile ${activeProfile.name}`, e);
    }
  }, [activeProfile]);

  // Save sessions to LocalStorage when they change
  const saveSessions = (updated: ChatSession[]) => {
    setSessions(updated);
    if (!activeProfile) return;
    try {
      localStorage.setItem(`wave_ai_sessions_${activeProfile.id}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save sessions to local storage', e);
    }
  };

  // Create or Update Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    let updatedProfiles = [...profiles];
    const pinToSave = requirePin ? profilePin : undefined;

    if (profileModalMode === 'create') {
      const newProfile: UserProfile = {
        id: Date.now().toString(),
        name: profileName.trim(),
        avatarEmoji: selectedEmoji,
        avatarColor: selectedColor,
        pin: pinToSave,
        createdAt: Date.now(),
      };
      updatedProfiles = [...updatedProfiles, newProfile];
      // Automatically log in to the newly created profile
      setActiveProfile(newProfile);
      localStorage.setItem('wave_ai_active_profile_id', newProfile.id);
      setShowProfileSelector(false);
    } else if (profileModalMode === 'edit' && editingProfile) {
      updatedProfiles = profiles.map(p => 
        p.id === editingProfile.id
          ? { ...p, name: profileName.trim(), avatarEmoji: selectedEmoji, avatarColor: selectedColor, pin: pinToSave }
          : p
      );
      // Update activeProfile if it is the one being edited
      if (activeProfile && activeProfile.id === editingProfile.id) {
        setActiveProfile({ ...activeProfile, name: profileName.trim(), avatarEmoji: selectedEmoji, avatarColor: selectedColor, pin: pinToSave });
      }
    }

    setProfiles(updatedProfiles);
    localStorage.setItem('wave_ai_profiles', JSON.stringify(updatedProfiles));
    
    // Close modal and reset fields
    setProfileModalMode(null);
    setEditingProfile(null);
    setProfileName('');
    setProfilePin('');
    setRequirePin(false);
  };

  // Delete Profile
  const handleDeleteProfile = (profileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this profile and all its chat history?')) {
      return;
    }

    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    setProfiles(updatedProfiles);
    localStorage.setItem('wave_ai_profiles', JSON.stringify(updatedProfiles));

    // Clear sessions for that profile
    localStorage.removeItem(`wave_ai_sessions_${profileId}`);

    // If deleting the active profile, log out
    if (activeProfile && activeProfile.id === profileId) {
      handleLogout();
    }
    
    // If we were editing this profile, close the modal
    if (editingProfile && editingProfile.id === profileId) {
      setProfileModalMode(null);
      setEditingProfile(null);
    }
  };

  // Profile Switching & Authentication
  const handleSelectProfile = (profile: UserProfile) => {
    if (profile.pin) {
      setUnlockingProfile(profile);
      setEnteredPin('');
      setPinError(false);
    } else {
      setActiveProfile(profile);
      localStorage.setItem('wave_ai_active_profile_id', profile.id);
      setShowProfileSelector(false);
    }
  };

  const handleUnlockProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockingProfile) return;

    if (enteredPin === unlockingProfile.pin) {
      setActiveProfile(unlockingProfile);
      localStorage.setItem('wave_ai_active_profile_id', unlockingProfile.id);
      setShowProfileSelector(false);
      setUnlockingProfile(null);
      setEnteredPin('');
      setPinError(false);
    } else {
      setPinError(true);
      setEnteredPin('');
      setTimeout(() => setPinError(false), 800);
    }
  };

  const handleLogout = () => {
    setActiveProfile(null);
    localStorage.removeItem('wave_ai_active_profile_id');
    setShowProfileSelector(true);
    setViewMode('landing');
  };

  const startEditProfile = (profile: UserProfile, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProfile(profile);
    setProfileName(profile.name);
    setSelectedEmoji(profile.avatarEmoji);
    setSelectedColor(profile.avatarColor);
    setRequirePin(!!profile.pin);
    setProfilePin(profile.pin || '');
    setProfileModalMode('edit');
  };

  const startCreateProfile = () => {
    setEditingProfile(null);
    setProfileName('');
    setSelectedEmoji('🌊');
    setSelectedColor('from-blue-600 to-indigo-600');
    setRequirePin(false);
    setProfilePin('');
    setProfileModalMode('create');
  };

  // Scroll to bottom when messages update
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle auto-expanding text area
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [chatInput]);

  // Create a new session
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Discussion',
      messages: [],
      createdAt: Date.now(),
    };
    const updated = [newSession, ...sessions];
    saveSessions(updated);
    setCurrentSessionId(newSession.id);
    setViewMode('chat');
    setChatInput('');
    // On mobile, close sidebar after starting a new chat
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Delete a session
  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    saveSessions(updated);
    
    if (currentSessionId === id) {
      if (updated.length > 0) {
        setCurrentSessionId(updated[0].id);
      } else {
        setCurrentSessionId(null);
        setViewMode('landing');
      }
    }
  };

  // Switch session
  const selectSession = (id: string) => {
    setCurrentSessionId(id);
    setViewMode('chat');
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Send message
  const handleSend = async (textToSend?: string) => {
    const rawText = textToSend || chatInput;
    const trimmed = rawText.trim();
    if (!trimmed || isLoading) return;

    // 1. Get or create current session
    let activeSessionId = currentSessionId;
    let currentSessionsCopy = [...sessions];
    
    if (!activeSessionId) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: trimmed.length > 25 ? trimmed.substring(0, 25) + '...' : trimmed,
        messages: [],
        createdAt: Date.now(),
      };
      currentSessionsCopy = [newSession, ...currentSessionsCopy];
      activeSessionId = newSession.id;
      setCurrentSessionId(activeSessionId);
      setViewMode('chat');
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
    };

    // 2. Add user message to active session
    let activeSession = currentSessionsCopy.find((s) => s.id === activeSessionId)!;
    
    // Update title if it was the first message
    if (activeSession.messages.length === 0) {
      activeSession.title = trimmed.length > 25 ? trimmed.substring(0, 25) + '...' : trimmed;
    }
    
    activeSession.messages = [...activeSession.messages, userMessage];
    saveSessions(currentSessionsCopy);
    setChatInput('');
    setIsLoading(true);

    // 3. Add assistant placeholder message
    const assistantId = (Date.now() + 1).toString();
    const placeholderMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
    };
    
    currentSessionsCopy = currentSessionsCopy.map((s) =>
      s.id === activeSessionId
        ? { ...s, messages: [...s.messages, placeholderMessage] }
        : s
    );
    saveSessions(currentSessionsCopy);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: activeSession.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Stream text update to state and localStorage
        currentSessionsCopy = currentSessionsCopy.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                messages: s.messages.map((m) =>
                  m.id === assistantId ? { ...m, content: fullText } : m
                ),
              }
            : s
        );
        setSessions(currentSessionsCopy);
      }
      
      // Finalize session save in LocalStorage
      saveSessions(currentSessionsCopy);

      if (!fullText) {
        updateAssistantMessage(activeSessionId, assistantId, "I'm sorry, I couldn't generate a response. Please try again.");
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      updateAssistantMessage(activeSessionId, assistantId, `Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateAssistantMessage = (sessionId: string, messageId: string, text: string) => {
    const updated = sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            messages: s.messages.map((m) =>
              m.id === messageId ? { ...m, content: text } : m
            ),
          }
        : s
    );
    saveSessions(updated);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (prompt: string) => {
    setViewMode('chat');
    if (!currentSessionId) {
      // Create session first
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: prompt.length > 25 ? prompt.substring(0, 25) + '...' : prompt,
        messages: [],
        createdAt: Date.now(),
      };
      const updated = [newSession, ...sessions];
      setSessions(updated);
      setCurrentSessionId(newSession.id);
      localStorage.setItem('wave_ai_sessions', JSON.stringify(updated));
      
      // Send message after a tiny state batch delay
      setTimeout(() => {
        handleSend(prompt);
      }, 50);
    } else {
      handleSend(prompt);
    }
  };

  // Image download helper
  const downloadImage = async (url: string, prompt: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `wave-image-${prompt.substring(0, 15).replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      // Fallback: Open in new tab
      window.open(url, '_blank');
    }
  };

  // Simple Markdown & custom parser
  const renderMessageContent = (msg: Message) => {
    const text = msg.content;
    if (!text) return <span className="animate-pulse opacity-60">▍</span>;

    // Check for custom widgets
    
    // 1. Pollinations Image Extraction
    const imgUrlMatch = text.match(/(https:\/\/pollinations\.ai\/p\/[^\s\)\"\'>]+)/i);
    const hasImage = !!imgUrlMatch;
    let cleanedText = text;
    let imageUrl = '';
    
    if (hasImage && imgUrlMatch) {
      imageUrl = imgUrlMatch[1];
      // Clean up the URL from the text so it doesn't print twice
      cleanedText = text.replace(imageUrl, '').replace(/Here's the image I generated for ".*":/i, '').replace(/\!\[.*\]\(.*\)/g, '').trim();
    }

    // 2. Weather Widget Extraction
    const weatherMatch = text.match(/Current weather in ([^:]+):\s*(-?\d+(?:\.\d+)?)\s*°C,\s*wind speed:\s*(\d+(?:\.\d+)?)\s*km\/h/i);
    const hasWeather = !!weatherMatch;
    
    // 3. Wikipedia Widget Extraction
    const wikiMatch = text.match(/According to Wikipedia:\s*([^]+)/i);
    const hasWiki = !!wikiMatch;

    return (
      <div className="space-y-4">
        {/* Render text with inline markdown */}
        {cleanedText && (
          <div className="msg-content whitespace-pre-wrap">
            {parseMarkdown(cleanedText)}
          </div>
        )}

        {/* Custom Image Widget */}
        {hasImage && imageUrl && (
          <div className="widget-card rounded-xl overflow-hidden mt-3 max-w-md group border border-blue-100 bg-white shadow-md">
            <div className="relative aspect-square w-full bg-slate-55 flex items-center justify-center overflow-hidden">
              {/* Blurred Background Loader */}
              {imageLoadingStates[imageUrl] !== false && (
                <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center z-10 space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">Visualizing...</span>
                </div>
              )}
              
              <img
                src={imageUrl}
                alt="AI Generated Wave Artwork"
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                onLoad={() => setImageLoadingStates(prev => ({ ...prev, [imageUrl]: false }))}
              />

              {/* Action Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 z-20">
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setLightboxImage(imageUrl)}
                    className="p-2 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 text-white transition-all transform hover:scale-105"
                    title="Zoom Image"
                  >
                    {/* Zoom Icon */}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => downloadImage(imageUrl, msg.content)}
                    className="p-2 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 text-white transition-all transform hover:scale-105"
                    title="Download Image"
                  >
                    {/* Download Icon */}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono">Image Generator</span>
                  <p className="text-xs text-white line-clamp-2 mt-0.5 shadow-sm font-medium">Click download to save in high quality</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Weather Widget */}
        {hasWeather && weatherMatch && (
          <div className="widget-card rounded-xl p-5 mt-2 max-w-sm border border-blue-100 bg-white shadow-md animate-fade-in text-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] text-blue-500 uppercase tracking-widest font-mono font-semibold">Live Weather</span>
                <h3 className="text-xl font-bold text-slate-800 mt-1">{weatherMatch[1]}</h3>
              </div>
              {/* Weather SVG Icon based on Celsius */}
              <div className="text-blue-500 p-2 bg-blue-50 rounded-xl border border-blue-100 animate-float">
                {parseFloat(weatherMatch[2]) > 20 ? (
                  /* Sun Icon */
                  <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                ) : (
                  /* Cloud Icon */
                  <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                  </svg>
                )}
              </div>
            </div>
            
            <div className="mt-4 flex items-baseline space-x-2">
              <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{weatherMatch[2]}</span>
              <span className="text-2xl font-semibold text-blue-500">°C</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <div>
                  <div className="font-mono text-[9px] uppercase text-slate-400">Wind Speed</div>
                  <div className="text-slate-700 font-medium">{weatherMatch[3]} km/h</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1" />
                </svg>
                <div>
                  <div className="font-mono text-[9px] uppercase text-slate-400">Source</div>
                  <div className="text-slate-700 font-medium">Open-Meteo</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Custom Wikipedia Widget */}
        {hasWiki && wikiMatch && (
          <div className="widget-card rounded-xl p-4 mt-2 max-w-lg border border-blue-100 bg-white shadow-md text-slate-800">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-white font-serif font-black text-xs">W</div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Wikipedia Knowledge</span>
            </div>
            <p className="text-sm text-slate-650 mt-3 leading-relaxed">
              {wikiMatch[1]}
            </p>
            <div className="mt-4 flex justify-end">
              <a
                href={`https://en.wikipedia.org/wiki/${encodeURIComponent(currentSession?.title || 'Special:Search')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
              >
                <span>Read Full Article</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper Markdown Text Parser
  const parseMarkdown = (text: string) => {
    const blocks = text.split(/(```[\s\S]*?```)/g);
    
    return blocks.map((block, idx) => {
      if (block.startsWith('```')) {
        const codeLines = block.slice(3, -3).trim().split('\n');
        const language = codeLines[0] && !codeLines[0].includes(' ') ? codeLines[0] : '';
        const code = language ? codeLines.slice(1).join('\n') : codeLines.join('\n');
        return (
          <pre key={idx} className="msg-code-block my-2 overflow-x-auto bg-slate-900 border border-slate-850 rounded-lg p-3 font-mono text-xs text-slate-200">
            {language && <div className="text-[9px] text-blue-400 mb-1.5 uppercase tracking-widest font-bold">{language}</div>}
            <code>{code}</code>
          </pre>
        );
      }
      
      const lines = block.split('\n');
      return lines.map((line, lIdx) => {
        // Bullet lists
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const itemText = line.replace(/^[\s]*[-*]\s+/, '');
          return (
            <li key={`${idx}-${lIdx}`} className="ml-4 list-disc text-sm my-1 text-inherit">
              {renderInlineMarkdown(itemText)}
            </li>
          );
        }
        
        // Ordered lists
        if (/^\d+\.\s+/.test(line.trim())) {
          const itemText = line.replace(/^[\s]*\d+\.\s+/, '');
          return (
            <li key={`${idx}-${lIdx}`} className="ml-4 list-decimal text-sm my-1 text-inherit">
              {renderInlineMarkdown(itemText)}
            </li>
          );
        }
        
        // Paragraph
        return line.trim() ? (
          <p key={`${idx}-${lIdx}`} className="text-sm my-1.5 leading-relaxed text-inherit">
            {renderInlineMarkdown(line)}
          </p>
        ) : (
          <div key={`${idx}-${lIdx}`} className="h-2" />
        );
      });
    });
  };

  const renderInlineMarkdown = (text: string) => {
    let parts: (string | React.ReactNode)[] = [text];
    
    // Bold
    parts = parts.flatMap((part) => {
      if (typeof part !== 'string') return part;
      const regex = /\*\*(.*?)\*\*/g;
      const split = part.split(regex);
      return split.map((str, i) => (i % 2 === 1 ? <strong key={i} className="text-blue-800 font-semibold">{str}</strong> : str));
    });

    // Inline code
    parts = parts.flatMap((part) => {
      if (typeof part !== 'string') return part;
      const regex = /`/g;
      const split = part.split(regex);
      return split.map((str, i) => (i % 2 === 1 ? <code key={i} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-rose-600 text-xs font-mono">{str}</code> : str));
    });

    // Inline URL links
    parts = parts.flatMap((part) => {
      if (typeof part !== 'string') return part;
      const regex = /\[(.*?)\]\((.*?)\)/g;
      const split = part.split(regex);
      const result: (string | React.ReactNode)[] = [];
      for (let i = 0; i < split.length; i++) {
        if (i % 3 === 0) {
          result.push(split[i]);
        } else if (i % 3 === 1) {
          const linkText = split[i];
          const url = split[i + 1];
          result.push(
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
              {linkText}
            </a>
          );
          i++;
        }
      }
      return result;
    });

    return parts;
  };

  return (
    <main className={`relative flex h-screen max-h-screen overflow-hidden transition-colors duration-500 ${
      viewMode === 'landing' ? 'bg-[#03050d] text-white' : 'bg-[#f4f8fc] text-slate-800'
    }`}>
      {/* Cinematic Looping Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-all duration-1000 ${
          viewMode === 'landing' 
            ? 'scale-100 filter brightness-50 opacity-100' 
            : 'scale-105 filter brightness-[0.12] blur-lg opacity-0 pointer-events-none'
        }`}
      >
        <source src="/wave_bg.mp4" type="video/mp4" />
      </video>

      {/* Global dark ambient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t from-[#02040a] via-transparent to-[#02040a]/40 z-0 pointer-events-none transition-opacity duration-1000 ${
        viewMode === 'landing' ? 'opacity-100' : 'opacity-0 pointer-events-none hidden'
      }`} />

      {/* LANDING VIEW (Slide 1 Representation) */}
      {viewMode === 'landing' && (
        <div className="relative z-10 w-full flex flex-col items-center justify-center p-6 text-center animate-fade-in select-none">
          <div className="max-w-xl space-y-8 animate-float">
            <div className="space-y-3">
              <h1 className="text-6xl md:text-7xl font-extrabold tracking-[0.2em] text-white uppercase">
                WAVE AI
              </h1>
              <p className="text-zinc-400 text-sm md:text-base tracking-wider uppercase max-w-md mx-auto leading-relaxed">
                Your intelligent agent with search, visual, and climate tools
              </p>
            </div>

            <button
              onClick={createNewSession}
              className="px-10 py-4 rounded-full font-bold text-sm tracking-widest uppercase transition-all duration-300 bg-blue-600 hover:bg-blue-500 text-white transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* CHAT VIEW (Slide 2 & 3 Representation) */}
      {viewMode === 'chat' && (
        <div className="relative z-10 w-full flex h-full max-h-full overflow-hidden">
          
          {/* SIDEBAR CONTAINER (Collapsible) */}
          <div
            className={`flex-shrink-0 h-full z-40 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
              sidebarOpen 
                ? 'w-72 border-r border-blue-100 bg-[#edf4fa]/95 backdrop-blur-md shadow-sm' 
                : 'w-0 border-r-0 pointer-events-none opacity-0'
            }`}
          >
            {/* Wrapper with fixed width to prevent text squishing */}
            <div className="w-72 h-full flex flex-col flex-shrink-0">
              {/* Sidebar Header */}
              <div className="p-5 border-b border-blue-100/50 flex items-center justify-between">
                <div
                  onClick={() => setViewMode('landing')}
                  className="flex items-center space-x-3 select-none cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <img src="/logo.png" alt="Wave Logo" className="w-8 h-8 object-contain" />
                  <span className="font-extrabold tracking-widest text-sm text-blue-900">WAVE AI</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 rounded-lg hover:bg-blue-100/50 text-blue-800 hover:text-blue-900 transition-colors md:hidden"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Active Profile Info */}
              {activeProfile && (
                <div className="mx-4 my-2 p-3 rounded-xl bg-white/70 border border-blue-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-2.5 overflow-hidden">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${activeProfile.avatarColor} p-[1.5px] flex-shrink-0`}>
                      <div className="w-full h-full bg-[#050b18] rounded-full flex items-center justify-center text-sm select-none">
                        {activeProfile.avatarEmoji}
                      </div>
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-[10px] text-blue-500 font-mono uppercase tracking-wider">Active Space</div>
                      <div className="text-xs font-bold text-slate-800 truncate leading-tight">{activeProfile.name}</div>
                    </div>
                  </div>
                  
                  {/* Switch/Logout Action */}
                  <button
                    onClick={handleLogout}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Switch Profile"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Sidebar Action Button */}
              <div className="p-4">
                <button
                  onClick={createNewSession}
                  className="w-full py-3 rounded-xl border border-blue-200 hover:border-blue-400 bg-white hover:bg-blue-50/50 flex items-center justify-center space-x-2 text-xs font-semibold uppercase tracking-wider text-blue-700 hover:text-blue-900 transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New Session</span>
                </button>
              </div>

              {/* Sidebar Scrollable History List */}
              <div className="flex-1 overflow-y-auto px-3 space-y-1.5">
                <div className="px-3 py-2 text-[10px] text-blue-900/60 uppercase tracking-widest font-bold font-mono">Discussion History</div>
                
                {sessions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">No previous chats</div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => selectSession(session.id)}
                      className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                        currentSessionId === session.id
                          ? 'bg-white border-blue-200 text-blue-800 shadow-sm font-semibold'
                          : 'bg-transparent border-transparent hover:bg-white/50 text-slate-650 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden pr-6">
                        {/* Chat bubble SVG */}
                        <svg className={`w-4 h-4 flex-shrink-0 ${currentSessionId === session.id ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-xs truncate font-medium">{session.title}</span>
                      </div>
                      {/* Delete action button */}
                      <button
                        onClick={(e) => deleteSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all absolute right-2"
                        title="Delete Session"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Sidebar Footer Details */}
              <div className="p-4 border-t border-blue-100/50 bg-[#e1edf7]/80 text-[10px] space-y-2 text-slate-500 font-mono">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Agent Server: <strong className="text-emerald-600">Online</strong></span>
                </div>
                <div className="text-[9px] text-slate-400">Model: Llama-3.1-8B-Instant</div>
              </div>
            </div>
          </div>

          {/* MAIN CHAT CONTENT AREA */}
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f4f8fc] min-w-0">
            
            {/* HEADER */}
            <header className="z-10 flex items-center justify-between p-4 md:p-5 border-b border-blue-100 bg-white/95 backdrop-blur-sm shadow-sm">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200/60 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {/* Burger menu toggle */}
                  {sidebarOpen ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
                <div>
                  <h2 className="text-sm font-bold tracking-wider text-slate-800">
                    {currentSession ? currentSession.title : 'Agent Chatroom'}
                  </h2>
                  <p className="text-[10px] text-blue-500 uppercase tracking-widest font-mono">Wave v1.0</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {activeProfile && (
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${activeProfile.avatarColor} p-[1.5px] flex items-center justify-center`} title={`${activeProfile.name}'s Space`}>
                    <div className="w-full h-full bg-[#050b18] rounded-full flex items-center justify-center text-[10px]">
                      {activeProfile.avatarEmoji}
                    </div>
                  </div>
                )}
                <img src="/logo.png" alt="Wave Logo" className="w-6 h-6 object-contain hidden md:block" />
              </div>
            </header>

            {/* MESSAGES VIEWPORT — only this scrolls */}
            <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 space-y-6">
              
              {/* WELCOME / GREETING SCREEN (Slide 2 & 3 Greeting) */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto space-y-8 animate-fade-in py-12">
                  <div className="space-y-3">
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-800">
                      ASK ME ANYTHING
                    </h1>
                    <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                      Send a message to explore details, generate bio-luminescent imagery, or fetch local weather parameters.
                    </p>
                  </div>

                  {/* Onboarding Quick Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-4">
                    
                    {/* Card 1: Weather */}
                    <div
                      onClick={() => handleQuickAction("What's the weather in Tokyo?")}
                      className="rounded-xl p-5 border border-blue-100 bg-white hover:bg-blue-50/50 cursor-pointer text-left group shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/50 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mt-4">Weather Forecast</h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">"What's the weather in Tokyo?"</p>
                    </div>

                    {/* Card 2: Image */}
                    <div
                      onClick={() => handleQuickAction("Generate an image of a glowing digital ocean wave")}
                      className="rounded-xl p-5 border border-blue-100 bg-white hover:bg-blue-50/50 cursor-pointer text-left group shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200/50 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mt-4">Image Creator</h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">"Generate an image of a glowing digital ocean wave"</p>
                    </div>

                    {/* Card 3: Wiki */}
                    <div
                      onClick={() => handleQuickAction("Wikipedia summary of quantum mechanics")}
                      className="rounded-xl p-5 border border-blue-100 bg-white hover:bg-blue-50/50 cursor-pointer text-left group shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/50 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mt-4">Fact Finder</h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">"Wikipedia summary of quantum mechanics"</p>
                    </div>

                  </div>
                </div>
              )}

              {/* ACTIVE CHAT LIST */}
              {messages.map((m, idx) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  style={{ animationDelay: `${Math.min(idx * 0.05, 0.4)}s` }}
                >
                  <div className="flex space-x-3.5 max-w-[85%] md:max-w-[75%] items-start">
                    
                    {/* Assistant Avatar */}
                    {m.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full border border-blue-200 bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <img src="/logo.png" alt="Wave Icon" className="w-4 h-4 object-contain" />
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-5 py-4 ${
                        m.role === 'user'
                          ? 'message-bubble-user text-white'
                          : 'bg-white border border-blue-100/80 text-slate-800 shadow-sm'
                      }`}
                    >
                      {/* Message Content Renderer */}
                      {m.role === 'user' ? (
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                      ) : (
                        renderMessageContent(m)
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Streaming loading state indicator */}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start items-center space-x-3.5 animate-pulse">
                  <div className="w-8 h-8 rounded-full border border-blue-200 bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <img src="/logo.png" alt="Wave Icon" className="w-4 h-4 object-contain animate-spin" />
                  </div>
                  <div className="bg-white rounded-2xl px-5 py-3 border border-blue-100 flex items-center space-x-1.5 text-blue-400 shadow-sm">
                    <span className="text-xs mr-1 uppercase tracking-wider font-mono">Thinking</span>
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* CHAT INPUT CONTAINER */}
            <div className="flex-shrink-0 p-4 md:p-6 border-t border-blue-100 bg-[#edf4fa]/60 backdrop-blur-sm">
              <form onSubmit={onSubmit} className="max-w-4xl mx-auto">
                <div className="bg-white border border-blue-200/80 rounded-2xl flex items-end p-2.5 space-x-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100/50 transition-all shadow-sm">
                  <textarea
                    ref={textareaRef}
                    id="message-input"
                    rows={1}
                    value={chatInput}
                    placeholder="Ask Wave... (e.g. Weather in Sydney)"
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={isLoading}
                    autoFocus
                    className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-slate-800 placeholder-slate-400 text-sm px-3.5 py-2 resize-none max-h-[180px] min-h-[36px]"
                  />
                  
                  <button
                    id="send-button"
                    type="submit"
                    disabled={isLoading || !chatInput.trim()}
                    className="p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed transition-all flex-shrink-0 flex items-center justify-center transform active:scale-95"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </form>
            </div>
            
          </div>
        </div>
      )}

      {/* PICTURE LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all transform active:scale-95 z-55"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <img
            src={lightboxImage}
            alt="AI Generative Fullscreen Zoomed View"
            className="max-h-[85vh] max-w-[95vw] object-contain rounded-xl border border-white/10 shadow-[0_0_80px_rgba(59,130,246,0.25)]"
          />
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono mt-4 font-semibold select-none">Click anywhere to close preview</p>
        </div>
      )}
    </main>
  );
}
