import { DateFilterType } from '../types';

export const DateUtils = {
  /**
   * Return today's local date as YYYY-MM-DD
   */
  getTodayString(): string {
    const d = new Date();
    return this.formatDateIso(d);
  },

  formatDateIso(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Format YYYY-MM-DD to readable format e.g. "Oct 12, 2026"
   */
  formatDisplayDate(isoString: string): string {
    if (!isoString) return '';
    try {
      const [year, month, day] = isoString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  },

  /**
   * Week starts Monday as specified in requirements
   */
  getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday...
    // Distance from Monday
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  getDateRange(type: DateFilterType, customStart?: string, customEnd?: string): { startDate: string; endDate: string } | null {
    const today = new Date();
    const todayStr = this.formatDateIso(today);

    switch (type) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };
      case 'week': {
        const startOfWeek = this.getStartOfWeek(today);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return {
          startDate: this.formatDateIso(startOfWeek),
          endDate: this.formatDateIso(endOfWeek)
        };
      }
      case 'month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          startDate: this.formatDateIso(startOfMonth),
          endDate: this.formatDateIso(endOfMonth)
        };
      }
      case 'year': {
        const startOfYear = new Date(today.getFullYear(), 0, 1);
        const endOfYear = new Date(today.getFullYear(), 11, 31);
        return {
          startDate: this.formatDateIso(startOfYear),
          endDate: this.formatDateIso(endOfYear)
        };
      }
      case 'custom':
        if (customStart && customEnd) {
          return { startDate: customStart, endDate: customEnd };
        }
        return null;
      case 'all':
      default:
        return null;
    }
  },

  isDateInRange(dateIso: string, range: { startDate: string; endDate: string } | null): boolean {
    if (!range) return true; // All dates allowed
    return dateIso >= range.startDate && dateIso <= range.endDate;
  },

  /**
   * Calculate Age of Receivable in days
   */
  getAgeInDays(saleDateIso: string): number {
    const [year, month, day] = saleDateIso.split('-').map(Number);
    const saleDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    saleDate.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - saleDate.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  },

  getAgingBucket(ageInDays: number): 'Current' | '1-30 days' | '31-60 days' | '60+ days' {
    if (ageInDays === 0) return 'Current';
    if (ageInDays <= 30) return '1-30 days';
    if (ageInDays <= 60) return '31-60 days';
    return '60+ days';
  }
};
