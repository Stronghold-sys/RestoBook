import React from "react";

export function SkeletonBase({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonMenuCard() {
  return (
    <div className="bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-border-light dark:border-border-dark flex flex-col gap-3">
      <SkeletonBase className="skeleton-image w-full" />
      <SkeletonBase className="skeleton-text-lg w-[70%]" />
      <SkeletonBase className="skeleton-text w-[90%]" />
      <SkeletonBase className="skeleton-text w-[50%]" />
      <div className="flex justify-between items-center mt-2">
        <SkeletonBase className="skeleton-text-lg w-[40%]" />
        <SkeletonBase className="skeleton-btn w-[30%]" />
      </div>
    </div>
  );
}

export function SkeletonOrderItem() {
  return (
    <div className="bg-card-light dark:bg-card-dark p-4 rounded-xl border border-border-light dark:border-border-dark flex items-center justify-between gap-4">
      <div className="flex-1 space-y-2.5">
        <SkeletonBase className="skeleton-text-lg w-[50%]" />
        <SkeletonBase className="skeleton-text w-[30%]" />
      </div>
      <div className="text-right space-y-2 flex flex-col items-end">
        <SkeletonBase className="skeleton-text-lg w-[60px]" />
        <SkeletonBase className="skeleton-badge w-[80px]" />
      </div>
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr className="border-b border-border-light dark:border-border-dark">
      <td className="p-4"><SkeletonBase className="skeleton-text w-[50px]" /></td>
      <td className="p-4"><SkeletonBase className="skeleton-text w-[120px]" /></td>
      <td className="p-4"><SkeletonBase className="skeleton-text w-[80px]" /></td>
      <td className="p-4"><SkeletonBase className="skeleton-badge w-[70px]" /></td>
      <td className="p-4"><SkeletonBase className="skeleton-btn w-[60px] h-[30px]" /></td>
    </tr>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark flex flex-col gap-3">
      <SkeletonBase className="skeleton-text w-[50%]" />
      <SkeletonBase className="skeleton-title w-[70%]" />
      <SkeletonBase className="skeleton-text w-[40%]" />
    </div>
  );
}

export function SkeletonUserProfile() {
  return (
    <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark flex items-center gap-4">
      <SkeletonBase className="skeleton-avatar shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBase className="skeleton-text-lg w-[60%]" />
        <SkeletonBase className="skeleton-text w-[40%]" />
      </div>
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-6 space-y-4">
          <SkeletonBase className="skeleton-title w-[40%]" />
          <div className="space-y-3">
            <SkeletonOrderItem />
            <SkeletonOrderItem />
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-6 space-y-4">
          <SkeletonBase className="skeleton-title w-[40%]" />
          <div className="space-y-3">
            <div className="flex gap-4 items-center p-3 bg-gray-55 dark:bg-gray-900/10 rounded-xl">
              <SkeletonBase className="skeleton-avatar" />
              <div className="flex-1 space-y-2">
                <SkeletonBase className="skeleton-text-lg w-[50%]" />
                <SkeletonBase className="skeleton-text w-[30%]" />
              </div>
            </div>
            <div className="flex gap-4 items-center p-3 bg-gray-55 dark:bg-gray-900/10 rounded-xl">
              <SkeletonBase className="skeleton-avatar" />
              <div className="flex-1 space-y-2">
                <SkeletonBase className="skeleton-text-lg w-[40%]" />
                <SkeletonBase className="skeleton-text w-[25%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
