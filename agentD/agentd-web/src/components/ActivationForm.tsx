import React, { useState } from 'react';

export default function ActivationForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/validate-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      setLoading(false);
      if (data.valid) {
        localStorage.setItem('activation', JSON.stringify({ email, code }));
        onSuccess();
      } else {
        setError(data.message || 'Invalid activation code.');
      }
    } catch (err) {
      setLoading(false);
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Enter Activation Code</h2>
        <input
          type="email"
          placeholder="Email"
          className="w-full mb-4 px-4 py-2 border rounded"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Activation Code"
          className="w-full mb-4 px-4 py-2 border rounded font-mono"
          value={code}
          onChange={e => setCode(e.target.value)}
          required
        />
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <button
          type="submit"
          className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full font-semibold shadow hover:from-purple-700 hover:to-blue-700 transition"
          disabled={loading}
        >
          {loading ? 'Checking...' : 'Activate'}
        </button>
        <div className="mt-4 text-gray-600 text-sm">
          Don&apos;t have a code?{' '}
          <a href="https://your-official-website.com" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
            Create one here
          </a>
        </div>
      </form>
    </div>
  );
} 