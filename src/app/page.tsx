'use client';
import React from 'react';
import VADVoiceClient from './VADVoiceClient';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white from-20% via-blue-50 via-40% to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <VADVoiceClient />
      </div>
    </div>
  );
}