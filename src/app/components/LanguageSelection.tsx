import React, { useState, useEffect } from 'react';
import { LanguageConfig } from '../services/LanguageDetectionService';

// Dialect configuration for Indian languages
interface DialectOption {
  code: string;
  name: string;
  region: string;
  description: string;
}

const INDIAN_DIALECTS: Record<string, DialectOption[]> = {
  'hi': [
    { code: 'standard', name: 'Standard Hindi', region: 'North India', description: 'Standard Hindi pronunciation' },
    { code: 'delhi', name: 'Delhi Hindi', region: 'Delhi', description: 'Delhi accent and dialect' },
    { code: 'mumbai', name: 'Mumbai Hindi', region: 'Mumbai', description: 'Mumbai accent and dialect' },
    { code: 'lucknow', name: 'Lucknow Hindi', region: 'Lucknow', description: 'Lucknow accent and dialect' },
    { code: 'bhopal', name: 'Bhopal Hindi', region: 'Bhopal', description: 'Bhopal accent and dialect' }
  ],
  'kn': [
    { code: 'standard', name: 'Standard Kannada', region: 'Karnataka', description: 'Standard Kannada pronunciation' },
    { code: 'bangalore', name: 'Bangalore Kannada', region: 'Bangalore', description: 'Bangalore accent and dialect' },
    { code: 'mysore', name: 'Mysore Kannada', region: 'Mysore', description: 'Mysore accent and dialect' },
    { code: 'mangalore', name: 'Mangalore Kannada', region: 'Mangalore', description: 'Mangalore accent and dialect' }
  ],
  'ta': [
    { code: 'standard', name: 'Standard Tamil', region: 'Tamil Nadu', description: 'Standard Tamil pronunciation' },
    { code: 'chennai', name: 'Chennai Tamil', region: 'Chennai', description: 'Chennai accent and dialect' },
    { code: 'madurai', name: 'Madurai Tamil', region: 'Madurai', description: 'Madurai accent and dialect' },
    { code: 'coimbatore', name: 'Coimbatore Tamil', region: 'Coimbatore', description: 'Coimbatore accent and dialect' }
  ],
  'bn': [
    { code: 'standard', name: 'Standard Bengali', region: 'West Bengal', description: 'Standard Bengali pronunciation' },
    { code: 'kolkata', name: 'Kolkata Bengali', region: 'Kolkata', description: 'Kolkata accent and dialect' },
    { code: 'siliguri', name: 'Siliguri Bengali', region: 'Siliguri', description: 'Siliguri accent and dialect' }
  ],
  'te': [
    { code: 'standard', name: 'Standard Telugu', region: 'Telangana/Andhra Pradesh', description: 'Standard Telugu pronunciation' },
    { code: 'hyderabad', name: 'Hyderabad Telugu', region: 'Hyderabad', description: 'Hyderabad accent and dialect' },
    { code: 'vijayawada', name: 'Vijayawada Telugu', region: 'Vijayawada', description: 'Vijayawada accent and dialect' }
  ],
  'mr': [
    { code: 'standard', name: 'Standard Marathi', region: 'Maharashtra', description: 'Standard Marathi pronunciation' },
    { code: 'mumbai', name: 'Mumbai Marathi', region: 'Mumbai', description: 'Mumbai accent and dialect' },
    { code: 'pune', name: 'Pune Marathi', region: 'Pune', description: 'Pune accent and dialect' },
    { code: 'nagpur', name: 'Nagpur Marathi', region: 'Nagpur', description: 'Nagpur accent and dialect' }
  ],
  'gu': [
    { code: 'standard', name: 'Standard Gujarati', region: 'Gujarat', description: 'Standard Gujarati pronunciation' },
    { code: 'ahmedabad', name: 'Ahmedabad Gujarati', region: 'Ahmedabad', description: 'Ahmedabad accent and dialect' },
    { code: 'surat', name: 'Surat Gujarati', region: 'Surat', description: 'Surat accent and dialect' }
  ],
  'ml': [
    { code: 'standard', name: 'Standard Malayalam', region: 'Kerala', description: 'Standard Malayalam pronunciation' },
    { code: 'thiruvananthapuram', name: 'Thiruvananthapuram Malayalam', region: 'Thiruvananthapuram', description: 'Thiruvananthapuram accent and dialect' },
    { code: 'kochi', name: 'Kochi Malayalam', region: 'Kochi', description: 'Kochi accent and dialect' }
  ],
  'pa': [
    { code: 'standard', name: 'Standard Punjabi', region: 'Punjab', description: 'Standard Punjabi pronunciation' },
    { code: 'amritsar', name: 'Amritsar Punjabi', region: 'Amritsar', description: 'Amritsar accent and dialect' },
    { code: 'ludhiana', name: 'Ludhiana Punjabi', region: 'Ludhiana', description: 'Ludhiana accent and dialect' }
  ],
  'or': [
    { code: 'standard', name: 'Standard Odia', region: 'Odisha', description: 'Standard Odia pronunciation' },
    { code: 'bhubaneswar', name: 'Bhubaneswar Odia', region: 'Bhubaneswar', description: 'Bhubaneswar accent and dialect' }
  ],
  'as': [
    { code: 'standard', name: 'Standard Assamese', region: 'Assam', description: 'Standard Assamese pronunciation' },
    { code: 'guwahati', name: 'Guwahati Assamese', region: 'Guwahati', description: 'Guwahati accent and dialect' }
  ],
  'ur': [
    { code: 'standard', name: 'Standard Urdu', region: 'India', description: 'Standard Urdu pronunciation' },
    { code: 'lucknow', name: 'Lucknow Urdu', region: 'Lucknow', description: 'Lucknow accent and dialect' },
    { code: 'hyderabad', name: 'Hyderabad Urdu', region: 'Hyderabad', description: 'Hyderabad accent and dialect' }
  ]
};

interface LanguageSelectionProps {
  languages: LanguageConfig[];
  onSelectLanguage: (language: LanguageConfig) => void;
  onDialectChange?: (dialect: string) => void;
  userLocation?: string;
  isMobile?: boolean;
}

const LanguageSelection: React.FC<LanguageSelectionProps> = ({ 
  languages, 
  onSelectLanguage, 
  onDialectChange,
  userLocation,
  isMobile = false 
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageConfig | null>(null);
  const [selectedDialect, setSelectedDialect] = useState<string>('standard');
  const [showDialectSelection, setShowDialectSelection] = useState(false);

  // Auto-select dialect based on user location
  useEffect(() => {
    if (selectedLanguage && userLocation && onDialectChange) {
      const dialects = INDIAN_DIALECTS[selectedLanguage.code];
      if (dialects) {
        // Try to find a dialect that matches the user's location
        const matchingDialect = dialects.find(dialect => 
          dialect.region.toLowerCase().includes(userLocation.toLowerCase()) ||
          userLocation.toLowerCase().includes(dialect.region.toLowerCase())
        );
        
        if (matchingDialect) {
          setSelectedDialect(matchingDialect.code);
          onDialectChange(matchingDialect.code);
        }
      }
    }
  }, [selectedLanguage, userLocation, onDialectChange]);

  const handleLanguageSelect = (language: LanguageConfig) => {
    setSelectedLanguage(language);
    
    // Check if this language has dialect options
    const hasDialects = INDIAN_DIALECTS[language.code] && INDIAN_DIALECTS[language.code].length > 1;
    
    if (hasDialects) {
      setShowDialectSelection(true);
    } else {
      // No dialect options, proceed directly
      onSelectLanguage(language);
      if (onDialectChange) {
        onDialectChange('standard');
      }
    }
  };

  const handleDialectSelect = (dialectCode: string) => {
    setSelectedDialect(dialectCode);
    if (onDialectChange) {
      onDialectChange(dialectCode);
    }
    
    // Proceed with language selection
    if (selectedLanguage) {
      onSelectLanguage(selectedLanguage);
    }
  };

  const handleBackToLanguages = () => {
    setSelectedLanguage(null);
    setShowDialectSelection(false);
    setSelectedDialect('standard');
  };

  if (showDialectSelection && selectedLanguage) {
    const dialects = INDIAN_DIALECTS[selectedLanguage.code] || [];
    
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <button
            onClick={handleBackToLanguages}
            className="mb-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            ← Back to Languages
          </button>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Choose Your {selectedLanguage.name} Dialect
          </h2>
          <p className="text-gray-600">
            Select a regional dialect for more natural speech
          </p>
          {userLocation && (
            <p className="text-sm text-blue-600 mt-2">
              📍 Detected location: {userLocation}
            </p>
          )}
        </div>

        <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'} mx-auto`}>
          {dialects.map((dialect) => (
            <button
              key={dialect.code}
              onClick={() => handleDialectSelect(dialect.code)}
              className={`flex flex-col items-start p-4 rounded-lg border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                selectedDialect === dialect.code
                  ? 'bg-blue-50 border-blue-400 shadow-md'
                  : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md'
              }`}
            >
              <div className="flex items-center w-full mb-2">
                <h3 className="font-medium text-gray-800 text-left">{dialect.name}</h3>
                {selectedDialect === dialect.code && (
                  <span className="ml-auto text-blue-600">✓</span>
                )}
              </div>
              <p className="text-sm text-gray-600 text-left mb-1">{dialect.region}</p>
              <p className="text-xs text-gray-500 text-left">{dialect.description}</p>
              
              {/* Location match indicator */}
              {userLocation && (
                dialect.region.toLowerCase().includes(userLocation.toLowerCase()) ||
                userLocation.toLowerCase().includes(dialect.region.toLowerCase())
              ) && (
                <div className="mt-2 flex items-center text-xs text-green-600">
                  <span>📍</span>
                  <span className="ml-1">Matches your location</span>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 max-w-lg mx-auto">
            Choose the dialect that best matches your region for the most natural voice experience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Choose Your Language</h2>
        <p className="text-gray-600">
          Select a language to start your conversation
        </p>
        {userLocation && (
          <p className="text-sm text-blue-600 mt-2">
            📍 Detected location: {userLocation}
          </p>
        )}
      </div>

      <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-4'} mx-auto`} role="listbox" aria-label="Available languages">
        {languages.map((language) => {
          const hasDialects = INDIAN_DIALECTS[language.code] && INDIAN_DIALECTS[language.code].length > 1;
          
          return (
            <button
              key={language.code}
              onClick={() => handleLanguageSelect(language)}
              className="flex flex-col items-center p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              role="option"
              aria-selected="false"
            >
              <div className="text-4xl mb-2" aria-hidden="true">
                {language.emoji || language.flag || '🇮🇳'}
              </div>
              <h3 className="font-medium text-gray-800">{language.name}</h3>
              <p className="text-sm text-gray-500">{language.nativeName}</p>
              
              {/* Dialect indicator */}
              {hasDialects && (
                <div className="mt-2 flex items-center text-xs text-blue-600">
                  <span>🎭</span>
                  <span className="ml-1">Multiple dialects available</span>
                </div>
              )}
              
              {/* Voice availability indicator */}
              <div className="mt-3 flex items-center text-xs text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" className="mr-1" aria-hidden="true">
                  <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z" />
                  <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v5zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3z" />
                </svg>
                <span>Voice Enabled</span>
              </div>

              {/* Accessibility description (screen readers only) */}
              <span className="sr-only">
                Select {language.name}, also known as {language.nativeName}, to begin conversation with voice support
                {hasDialects && ' - multiple regional dialects available'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500 max-w-lg mx-auto">
          This application supports both text and voice conversations in multiple Indian languages with regional dialects, powered by advanced AI voice technology.
        </p>
      </div>
    </div>
  );
};

export default LanguageSelection; 