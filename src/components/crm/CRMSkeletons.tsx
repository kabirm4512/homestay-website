'use client';

import React from 'react';

export function TapeChartSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white rounded-3xl p-6 border border-sand-200">
        <div className="h-6 w-64 bg-sand-200 rounded-lg mb-2" />
        <div className="h-4 w-96 bg-sand-100 rounded-lg mb-4" />
        <div className="flex gap-2">
          <div className="min-h-[44px] w-28 bg-sand-200 rounded-xl" />
          <div className="min-h-[44px] w-28 bg-sand-100 rounded-xl" />
          <div className="min-h-[44px] w-28 bg-sand-100 rounded-xl" />
        </div>
      </div>
      <div className="bg-white rounded-3xl p-4 border border-sand-200">
        <div className="space-y-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="h-12 w-48 bg-sand-200 rounded-xl shrink-0" />
              <div className="flex-1 grid grid-cols-6 gap-2">
                {[...Array(6)].map((_, j) => (
                  <div key={j} className="h-12 bg-sand-100 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OperationsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-3xl p-5 border border-sand-200 h-28">
            <div className="h-4 w-28 bg-sand-200 rounded mb-3" />
            <div className="h-8 w-16 bg-sand-300 rounded mb-2" />
            <div className="h-3 w-36 bg-sand-100 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-3xl p-6 border border-sand-200 space-y-4">
        <div className="h-6 w-48 bg-sand-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-sand-50 rounded-2xl p-4 border border-sand-200 h-36" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function KitchenSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-forest-900 rounded-3xl p-6 h-28" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-3xl p-5 border border-sand-200 h-48">
            <div className="h-5 w-32 bg-sand-200 rounded mb-3" />
            <div className="h-4 w-44 bg-sand-100 rounded mb-4" />
            <div className="h-16 bg-sand-50 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinancialSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-3xl p-5 border border-sand-200 h-28">
            <div className="h-4 w-32 bg-sand-200 rounded mb-2" />
            <div className="h-8 w-24 bg-sand-300 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-3xl p-6 border border-sand-200 h-64" />
    </div>
  );
}

export function ConciergeSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      <div className="bg-forest-900 rounded-3xl p-6 h-32" />
      <div className="h-12 w-64 bg-sand-200 rounded-2xl mx-auto" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-3xl p-4 border border-sand-200 h-72">
            <div className="h-44 bg-sand-200 rounded-2xl mb-3" />
            <div className="h-5 w-3/4 bg-sand-300 rounded mb-2" />
            <div className="h-4 w-1/2 bg-sand-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
