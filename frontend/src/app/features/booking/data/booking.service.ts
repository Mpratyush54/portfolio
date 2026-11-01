import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBase } from '../../../core/api/api-base';

export type SlotInfo = {
  slot: string;
  label: string;
  available: boolean;
  amountPaise?: number;
  amountLabel?: string;
  demand?: string;
};

export type SlotDay = {
  date: string;
  label: string;
  slots: SlotInfo[];
  amountPaise?: number;
  amountLabel?: string;
  demand?: string;
};

export type SpotsPayload = {
  amountPaise: number;
  amountLabel: string;
  baseLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  minPaise?: number;
  maxPaise?: number;
  currency: string;
  title: string;
  durationMin: number;
  timezone: string;
  paymentsEnabled: boolean;
  razorpayKeyId: string;
  bookingEmail?: string;
  pricingNote?: string;
  start: string;
  end: string;
  days: SlotDay[];
};

export type PaymentVerification = {
  bookingId: string;
  correlationId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type CheckoutOrder = {
  bookingId: string;
  correlationId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  slotLabel: string;
  holdExpiresAt: string;
};

@Injectable({ providedIn: 'root' })
export class BookingService {
  private http = inject(HttpClient);

  getSlots(): Observable<SpotsPayload> {
    return this.http.get<SpotsPayload>(`${apiBase()}/bookings/slots`);
  }

  getConfig(): Observable<any> {
    return this.http.get<any>(`${apiBase()}/bookings/config`);
  }

  createOrder(details: unknown): Observable<CheckoutOrder> {
    return this.http.post<CheckoutOrder>(`${apiBase()}/bookings/create-order`, details);
  }

  verify(payload: PaymentVerification): Observable<{ success: boolean; status: string }> {
    return this.http.post<{ success: boolean; status: string }>(
      `${apiBase()}/bookings/verify`,
      payload,
    );
  }
}
