/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  MessageSquare, 
  Bell, 
  Send, 
  Upload, 
  ShieldCheck, 
  MapPin, 
  Loader2,
  ChevronRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { db, auth } from './lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

interface Message {
  role: 'user' | 'agent';
  text: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'subscribe' | 'alerts' | 'upload'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', text: 'Hello! I am your Ward Budget Assistant. Ask me anything about how the county budget affects your area.' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [ward, setWard] = useState('Kilimani');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [alerts, setAlerts] = useState<{ details: string; date: string }[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const userMessage = userInput;
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setUserInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage, ward })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'agent', text: data.answer || data.error }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'agent', text: 'Sorry, I am having technical difficulties. Please try again later.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, ward })
      });
      const data = await res.json();
      alert(data.message);
      setPhone('');
    } catch (error) {
      alert("Subscription failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploadStatus('Uploading and parsing budget...');
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('budget', file);
    formData.append('ward', ward);

    try {
      const res = await fetch('/api/upload-budget', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setUploadStatus(data.message || data.error);
    } catch (error) {
      setUploadStatus('Failed to upload budget.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-lg text-white">W</div>
          <div>
            <h1 className="font-semibold text-lg tracking-tight text-white">WardBudget AI</h1>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarLink 
            icon={<MessageSquare size={18} />} 
            label="Budget Assistant" 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
          />
          <SidebarLink 
            icon={<Bell size={18} />} 
            label="Gazette Monitor" 
            active={activeTab === 'alerts'} 
            onClick={() => setActiveTab('alerts')} 
          />
          <SidebarLink 
            icon={<TrendingDown size={18} />} 
            label="SMS Gateway" 
            active={activeTab === 'subscribe'} 
            onClick={() => setActiveTab('subscribe')} 
          />
          <div className="pt-4 border-t border-slate-800 mt-4">
             <SidebarLink 
              icon={<Upload size={18} />} 
              label="PDF Ingestion" 
              active={activeTab === 'upload'} 
              onClick={() => setActiveTab('upload')} 
            />
          </div>
        </nav>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3">System Status</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Gemini AI</span>
              <span className="text-emerald-400 font-medium">Active</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Vector Store</span>
              <span className="text-emerald-400 font-medium">Synced</span>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="p-3 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="text-emerald-400 w-3 h-3" />
                <span className="font-bold text-[10px] uppercase tracking-wider text-slate-300">Selected Ward</span>
              </div>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
              >
                <option>Kilimani</option>
                <option>Kitisuru</option>
                <option>Parklands</option>
                <option>Mbagathi</option>
                <option>Roysambu</option>
              </select>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 px-8 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <span className="hidden sm:inline">County Budget FY 2024/25</span>
            <span className="sm:hidden">FY 2024/25</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-600 uppercase border border-slate-200">NAIROBI_COUNTY_V4.PDF</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('upload')}
              className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Re-Index Ward Data
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto h-full flex flex-col"
              >
                <div className="flex-1 flex flex-col gap-4 mb-6">
                  {messages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-tr-none' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                      }`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 flex items-center gap-2 shadow-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                        <span className="text-sm text-slate-400 italic">Agent is analyzing budget...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="sticky bottom-0 bg-slate-50 pt-2">
                  <div className="relative group">
                    <input 
                      type="text" 
                      placeholder="Ask about school funding, road repairs, or project details..."
                      className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-14 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder-slate-400"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button 
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                      onClick={handleSendMessage}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center mt-3 uppercase tracking-widest font-semibold italic">
                    AI can make mistakes. Verify with official county documents.
                  </p>
                </div>
              </motion.div>
            )}

            {activeTab === 'subscribe' && (
              <motion.div 
                key="subscribe"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md mx-auto"
              >
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl text-center">
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <TrendingDown className="text-emerald-600 w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2 text-slate-800">Budget Digest</h2>
                  <p className="text-slate-500 text-sm mb-8">Receive concise Weekly SMS summaries of budget changes for {ward} Ward.</p>
                  
                  <form onSubmit={handleSubscribe} className="space-y-4">
                    <div className="text-left">
                      <label className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1 block">Phone Number</label>
                      <input 
                        type="tel" 
                        required
                        placeholder="+254 700 000000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <button 
                      disabled={isSubmitting}
                      className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-200/50"
                    >
                      {isSubmitting ? 'Subscribing...' : 'Opt-in for SMS Alerts'}
                    </button>
                  </form>
                  <p className="text-[10px] text-gray-400 mt-4">Standard career rates apply. Opt-out anytime by texting STOP.</p>
                </div>
              </motion.div>
            )}

            {activeTab === 'alerts' && (
              <motion.div 
                key="alerts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-3xl mx-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Gazette Monitor
                  </h2>
                  <button 
                    onClick={async () => {
                      const res = await fetch('/api/gazette-check');
                      const data = await res.json();
                      if (data.amendmentFound) {
                        setAlerts(prev => [{ details: data.details, date: new Date().toLocaleDateString() }, ...prev]);
                      } else {
                        alert("No new amendments found at this time.");
                      }
                    }}
                    className="text-xs font-bold text-emerald-600 hover:underline px-3 py-1 bg-emerald-50 rounded-full"
                  >
                    Scan Now
                  </button>
                </div>

                <div className="space-y-4">
                  {alerts.length === 0 ? (
                    <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white shadow-sm">
                      <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm italic">No recent amendments found for this budget period.</p>
                    </div>
                  ) : (
                    alerts.map((alert, i) => (
                      <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4 transition-all hover:border-emerald-200">
                        <div className="p-2 bg-emerald-50 rounded-lg mt-1">
                          <Bell size={18} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-slate-800 font-semibold mb-1">{alert.details}</p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{alert.date} • Kenya Gazette Supplement</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'upload' && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-2xl mx-auto"
              >
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h2 className="text-xl font-bold mb-6 text-slate-800">PDF Ingestion Pipeline</h2>
                  <p className="text-sm text-slate-500 mb-8 border-l-4 border-amber-400 pl-4 bg-amber-50/50 py-3">
                    Upload the official 400-page PDF document here. Our AI will chunk and index it for resident queries.
                  </p>

                  <form onSubmit={handleFileUpload} className="space-y-6">
                    <div 
                      className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/20 transition-all group"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
                      }}
                      onClick={() => document.getElementById('file-input')?.click()}
                    >
                      <Upload className="w-12 h-12 text-slate-300 mb-4 group-hover:text-emerald-500 transition-colors" />
                      <p className="text-sm font-semibold text-slate-600">
                        {file ? file.name : 'Click or drag PDF to upload'}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">Max file size: 50MB (Standard PDF)</p>
                      <input 
                        id="file-input"
                        type="file" 
                        accept=".pdf" 
                        className="hidden" 
                        onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                      />
                    </div>

                    <button 
                      disabled={isSubmitting || !file}
                      className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-black transition-all disabled:opacity-30 flex items-center justify-center gap-3 shadow-lg shadow-slate-200/50"
                    >
                      {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                      {isSubmitting ? 'Processing RAG Chunks...' : 'Start Ingestion'}
                    </button>
                  </form>
                  {uploadStatus && (
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono text-slate-600">
                      {uploadStatus}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active 
        ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700' 
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
      }`}
    >
      <div className={`transition-colors ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
        {icon}
      </div>
      <span>{label}</span>
      {active && <motion.div layoutId="pill" className="ml-auto w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />}
    </button>
  );
}
