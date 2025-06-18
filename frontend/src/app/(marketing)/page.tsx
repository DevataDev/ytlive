'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBroadcastTower,
  faPlay,
  faCheckCircle,
  faChartLine,
  faCloudUpload,
  faComments,
  faShieldAlt,
  faPalette,
  faHeart,
  faBars,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import {
  faYoutube,
  faFacebook,
  faTwitter,
  faInstagram,
  faTiktok,
} from '@fortawesome/free-brands-svg-icons';

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="bg-white shadow-sm fixed top-0 w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2 text-primary-600 font-bold text-2xl">
              <FontAwesomeIcon icon={faBroadcastTower} className="text-2xl" />
              <span>YukLive</span>
            </Link>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">
                Pricing
              </a>
              <a href="#stats" className="text-gray-600 hover:text-primary-600 font-medium transition-colors">
                Statistics
              </a>
            </div>
            
            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex items-center space-x-3">
              <Link href="/login" className="px-4 py-2 text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-600 hover:text-white transition-all">
                Sign In
              </Link>
              <Link href="/register" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all">
                Get Started
              </Link>
            </div>
            
            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2 rounded-lg text-gray-600 hover:text-primary-600 hover:bg-gray-100"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <FontAwesomeIcon icon={isMenuOpen ? faTimes : faBars} className="text-xl" />
            </button>
          </div>
          
          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="flex flex-col space-y-3">
                <a href="#features" className="px-3 py-2 text-gray-600 hover:text-primary-600 font-medium">
                  Features
                </a>
                <a href="#pricing" className="px-3 py-2 text-gray-600 hover:text-primary-600 font-medium">
                  Pricing
                </a>
                <a href="#stats" className="px-3 py-2 text-gray-600 hover:text-primary-600 font-medium">
                  Statistics
                </a>
                <div className="flex flex-col space-y-2 pt-3 border-t border-gray-200">
                  <Link href="/login" className="px-3 py-2 text-primary-600 border border-primary-600 rounded-lg text-center hover:bg-primary-600 hover:text-white transition-all">
                    Sign In
                  </Link>
                  <Link href="/register" className="px-3 py-2 bg-primary-600 text-white rounded-lg text-center hover:bg-primary-700 transition-all">
                    Get Started
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-20" style={{marginTop: '64px'}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[75vh]">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Professional Multi-Platform Live Streaming
                <span className="text-yellow-400"> Solution</span>
              </h1>
              <p className="text-xl text-gray-100 leading-relaxed">
                Stream simultaneously to YouTube, TikTok, Facebook, Instagram, and more platforms with our 
                professional streaming solution. Advanced analytics, media management, and real-time monitoring 
                for content creators and businesses.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/register" className="px-8 py-4 bg-yellow-500 text-gray-900 rounded-lg font-semibold text-lg hover:bg-yellow-400 transition-all transform hover:scale-105">
                  Start Streaming Free
                </Link>
                <button className="px-8 py-4 border-2 border-white text-white rounded-lg font-semibold text-lg hover:bg-white hover:text-gray-900 transition-all flex items-center justify-center space-x-2">
                  <FontAwesomeIcon icon={faPlay} />
                  <span>Watch Demo</span>
                </button>
              </div>
              <div className="flex items-center space-x-2 text-gray-200">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-400" />
                <span>No credit card required • 14-day free trial</span>
              </div>
            </div>
            <div className="flex justify-center">
              <div className="relative max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-2xl p-6 text-gray-900">
                  <div className="flex justify-between items-center mb-6">
                    <h6 className="font-semibold text-lg">Live Stream Dashboard</h6>
                    <span className="px-3 py-1 bg-green-500 text-white text-sm rounded-full font-medium">LIVE</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-red-600 text-white rounded-lg p-4 text-center transform hover:scale-105 transition-transform">
                      <FontAwesomeIcon icon={faYoutube} className="text-2xl mb-2" />
                      <div className="text-sm font-medium">YouTube</div>
                    </div>
                    <div className="bg-gray-900 text-white rounded-lg p-4 text-center transform hover:scale-105 transition-transform">
                      <FontAwesomeIcon icon={faTiktok} className="text-2xl mb-2" />
                      <div className="text-sm font-medium">TikTok</div>
                    </div>
                    <div className="bg-blue-600 text-white rounded-lg p-4 text-center transform hover:scale-105 transition-transform">
                      <FontAwesomeIcon icon={faFacebook} className="text-2xl mb-2" />
                      <div className="text-sm font-medium">Facebook</div>
                    </div>
                    <div className="bg-blue-400 text-white rounded-lg p-4 text-center transform hover:scale-105 transition-transform">
                      <FontAwesomeIcon icon={faTwitter} className="text-2xl mb-2" />
                      <div className="text-sm font-medium">Twitter</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Powerful Features</h2>
            <p className="text-xl text-gray-600">Everything you need to grow your streaming presence</p>
          </div>
          
          <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center transform hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FontAwesomeIcon icon={faBroadcastTower} className="text-primary-600 text-3xl" />
              </div>
              <h5 className="text-xl font-bold mb-4 text-gray-900">Multi-Platform Streaming</h5>
              <p className="text-gray-600">Stream simultaneously to YouTube, TikTok, Facebook, Twitter, and more platforms with a single setup.</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center transform hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FontAwesomeIcon icon={faChartLine} className="text-green-600 text-3xl" />
              </div>
              <h5 className="text-xl font-bold mb-4 text-gray-900">Real-time Analytics</h5>
              <p className="text-gray-600">Track your performance across all platforms with detailed analytics and insights in real-time.</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center transform hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FontAwesomeIcon icon={faCloudUpload} className="text-yellow-600 text-3xl" />
              </div>
              <h5 className="text-xl font-bold mb-4 text-gray-900">Cloud Recording</h5>
              <p className="text-gray-600">Automatically record and store your streams in the cloud for later use and content repurposing.</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center transform hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FontAwesomeIcon icon={faComments} className="text-blue-600 text-3xl" />
              </div>
              <h5 className="text-xl font-bold mb-4 text-gray-900">Unified Chat</h5>
              <p className="text-gray-600">Manage all your platform chats in one place with our unified chat management system.</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center transform hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FontAwesomeIcon icon={faShieldAlt} className="text-red-600 text-3xl" />
              </div>
              <h5 className="text-xl font-bold mb-4 text-gray-900">Enterprise Security</h5>
              <p className="text-gray-600">Bank-level security with encrypted streams and secure authentication for all your content.</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center transform hover:-translate-y-2 transition-all duration-300">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FontAwesomeIcon icon={faPalette} className="text-purple-600 text-3xl" />
              </div>
              <h5 className="text-xl font-bold mb-4 text-gray-900">Custom Branding</h5>
              <p className="text-gray-600">Customize your streaming interface with your brand colors, logos, and overlays.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section id="stats" className="py-20 bg-primary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Trusted by Creators Worldwide</h2>
            <p className="text-xl text-primary-100">Join thousands of successful streamers</p>
          </div>
          
          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8 text-center">
            <div className="space-y-2">
              <h3 className="text-5xl md:text-6xl font-bold text-yellow-400">50K+</h3>
              <p className="text-xl text-primary-100">Active Streamers</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-5xl md:text-6xl font-bold text-yellow-400">2M+</h3>
              <p className="text-xl text-primary-100">Hours Streamed</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-5xl md:text-6xl font-bold text-yellow-400">15+</h3>
              <p className="text-xl text-primary-100">Platforms Supported</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-5xl md:text-6xl font-bold text-yellow-400">99.9%</h3>
              <p className="text-xl text-primary-100">Uptime Guarantee</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-600">Choose the plan that fits your streaming needs</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 transform hover:-translate-y-2 transition-all duration-300">
              <div className="text-center mb-8">
                <h5 className="text-xl font-bold text-primary-600 mb-4">Starter</h5>
                <div className="mb-2">
                  <span className="text-5xl font-bold text-gray-900">$9</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-gray-600">Perfect for beginners</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                  <span>Stream to 3 platforms</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                  <span>5 hours recording storage</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                  <span>Basic analytics</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                  <span>Email support</span>
                </li>
              </ul>
              
              <Link href="/register" className="w-full block text-center px-6 py-3 border border-primary-600 text-primary-600 rounded-lg font-semibold hover:bg-primary-600 hover:text-white transition-all">
                Start Free Trial
              </Link>
            </div>
            
            <div className="bg-primary-600 text-white rounded-2xl shadow-2xl p-8 relative transform hover:-translate-y-2 transition-all duration-300">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-yellow-400 text-gray-900 px-6 py-2 rounded-full text-sm font-bold">Most Popular</span>
              </div>
              
              <div className="text-center mb-8 mt-4">
                <h5 className="text-xl font-bold mb-4">Professional</h5>
                <div className="mb-2">
                  <span className="text-5xl font-bold">$29</span>
                  <span className="text-primary-200">/month</span>
                </div>
                <p className="text-primary-200">For serious creators</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-yellow-400" />
                  <span>Stream to 10 platforms</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-yellow-400" />
                  <span>50 hours recording storage</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-yellow-400" />
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-yellow-400" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-yellow-400" />
                  <span>Custom branding</span>
                </li>
              </ul>
              
              <Link href="/register" className="w-full block text-center px-6 py-3 bg-yellow-400 text-gray-900 rounded-lg font-bold hover:bg-yellow-300 transition-all">
                Start Free Trial
              </Link>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 transform hover:-translate-y-2 transition-all duration-300">
              <div className="text-center mb-8">
                <h5 className="text-xl font-bold text-primary-600 mb-4">Enterprise</h5>
                <div className="mb-2">
                  <span className="text-5xl font-bold text-gray-900">$99</span>
                  <span className="text-gray-600">/month</span>
                </div>
                <p className="text-gray-600">For large organizations</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                  <span>Unlimited platforms</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                  <span>Unlimited storage</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                  <span>White-label solution</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                  <span>24/7 phone support</span>
                </li>
                <li className="flex items-center space-x-3">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                  <span>API access</span>
                </li>
              </ul>
              
              <button className="w-full px-6 py-3 border border-primary-600 text-primary-600 rounded-lg font-semibold hover:bg-primary-600 hover:text-white transition-all">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Start Streaming?</h2>
          <p className="text-xl mb-8 text-gray-100">Join thousands of creators who trust YukLive for their multi-platform streaming needs.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="px-10 py-4 bg-yellow-500 text-gray-900 rounded-lg font-bold text-lg hover:bg-yellow-400 transition-all transform hover:scale-105">
              Start Your Free Trial
            </Link>
            <button className="px-10 py-4 border-2 border-white text-white rounded-lg font-bold text-lg hover:bg-white hover:text-gray-900 transition-all">
              Schedule a Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 md:grid-cols-2 gap-8">
            <div className="lg:col-span-2">
              <div className="mb-6">
                <Link href="/" className="flex items-center space-x-2 text-white">
                  <FontAwesomeIcon icon={faBroadcastTower} className="text-2xl" />
                  <h4 className="text-2xl font-bold">YukLive</h4>
                </Link>
                <p className="text-gray-400 mt-4 max-w-md">
                  The ultimate multi-platform streaming solution for content creators and businesses.
                </p>
              </div>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  <FontAwesomeIcon icon={faFacebook} className="text-xl" />
                </a>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  <FontAwesomeIcon icon={faTwitter} className="text-xl" />
                </a>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  <FontAwesomeIcon icon={faInstagram} className="text-xl" />
                </a>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  <FontAwesomeIcon icon={faYoutube} className="text-xl" />
                </a>
              </div>
            </div>
            
            <div>
              <h6 className="font-bold mb-4">Product</h6>
              <ul className="space-y-3">
                <li>
                  <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
                </li>
                <li>
                  <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">API</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Integrations</a>
                </li>
              </ul>
            </div>
            
            <div>
              <h6 className="font-bold mb-4">Company</h6>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">About</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Careers</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a>
                </li>
              </ul>
            </div>
            
            <div>
              <h6 className="font-bold mb-4">Support</h6>
              <ul className="space-y-3">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Help Center</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Documentation</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Community</a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white transition-colors">Status</a>
                </li>
              </ul>
            </div>
          </div>
          
          <hr className="my-8 border-gray-700" />
          
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 text-center md:text-left">
              2025 YukLive. All rights reserved. PT Jejaring Internet Bersama
            </p>
            <p className="text-gray-400 text-center md:text-right flex items-center space-x-1">
              <span>Made with</span>
              <FontAwesomeIcon icon={faHeart} className="text-red-500" />
              <span>for creators</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
