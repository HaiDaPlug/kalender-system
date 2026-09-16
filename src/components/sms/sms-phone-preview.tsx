'use client'

import { ChevronLeft, Video } from 'lucide-react'
import { Iphone } from '@/components/ui/iphone'

interface Props {
  /** The fully rendered message (variables already replaced). */
  message: string
  /** Sender id shown as the contact name, e.g. "KOMFORT". */
  sender: string
  /** Current time "HH:MM" — shown in the status bar and the "Idag" divider. Empty until hydrated. */
  time: string
}

/*
  The confirmation SMS the way the customer will actually see it: iOS Messages
  in light mode, one received message, real clock. Sized for a ~300px-wide
  phone; the page crops the lower part of the phone with a fade.
*/
export function SmsPhonePreview({ message, sender, time }: Props) {
  const initial = sender.trim().charAt(0).toUpperCase() || '?'

  return (
    <Iphone>
      <div className="flex h-full w-full flex-col bg-white text-black font-sans select-none antialiased">
        {/* Status bar — either side of the Dynamic Island */}
        <div className="flex items-center justify-between px-[9%] pt-[5.2%] text-[12.5px] font-semibold tracking-tight">
          <span className="tabular min-w-[2.6em]">{time}</span>
          <span className="flex items-center gap-[5px]" aria-hidden>
            <span className="flex items-end gap-[1.5px]">
              <span className="w-[3px] h-[4px] rounded-[1px] bg-black" />
              <span className="w-[3px] h-[6px] rounded-[1px] bg-black" />
              <span className="w-[3px] h-[8px] rounded-[1px] bg-black" />
              <span className="w-[3px] h-[10px] rounded-[1px] bg-black" />
            </span>
            <svg width="14" height="10" viewBox="0 0 16 12" fill="none">
              <path d="M1 4.2C4.9.6 11.1.6 15 4.2M3.5 6.9c2.5-2.4 6.5-2.4 9 0M6 9.6c1.1-1.1 2.9-1.1 4 0" stroke="black" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="flex items-center">
              <span className="w-[22px] h-[11px] rounded-[3px] border border-black/40 p-[1.5px]">
                <span className="block h-full w-[86%] rounded-[1.5px] bg-black" />
              </span>
              <span className="w-[1.5px] h-[4px] rounded-r-sm bg-black/40 ml-[1px]" />
            </span>
          </span>
        </div>

        {/* Conversation header */}
        <div className="relative mt-[3.5%] flex flex-col items-center gap-1 pb-2.5 border-b border-black/10 bg-[#F9F9F9]/95">
          <ChevronLeft className="absolute left-[4%] top-2 h-5 w-5 text-[#0A84FF]" strokeWidth={2.5} />
          <Video className="absolute right-[6%] top-2.5 h-[18px] w-[18px] text-[#0A84FF]" strokeWidth={2} />
          <div className="h-[46px] w-[46px] rounded-full bg-gradient-to-b from-[#A7A7AD] to-[#7C7C82] flex items-center justify-center text-[18px] font-semibold text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
            {initial}
          </div>
          <span className="text-[11px] font-medium text-black/85 flex items-center gap-0.5">
            {sender}
            <span className="text-black/30 text-[10px]">›</span>
          </span>
        </div>

        {/* The one message */}
        <div className="flex-1 min-h-0 px-[4.5%] pt-3 space-y-2 overflow-hidden">
          <p className="text-center text-[9.5px] text-[#8E8E93] font-medium pt-0.5">
            <span className="font-semibold">SMS</span> · Idag {time}
          </p>
          <div className="flex">
            <div className="max-w-[84%] rounded-[16px] rounded-bl-[5px] bg-[#E9E9EB] px-3 py-[7px] text-[12.5px] leading-[1.35] text-black whitespace-pre-wrap break-words">
              {message || <span className="text-[#8E8E93] italic">Tomt meddelande</span>}
            </div>
          </div>
        </div>
      </div>
    </Iphone>
  )
}
