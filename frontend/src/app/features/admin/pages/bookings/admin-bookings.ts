import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminAuthService } from '../../data/admin-auth.service';
import { AdminBookingsService, BookingRow } from '../../data/admin-bookings.service';
import { AdminWorkspaceService } from '../../data/admin-workspace.service';

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-bookings.html'
})
export class AdminBookingsComponent implements OnInit, OnDestroy {
  private auth = inject(AdminAuthService);
  private bookingsApi = inject(AdminBookingsService);
  workspace = inject(AdminWorkspaceService);
  private route = inject(ActivatedRoute);
  private alive = true;

  bookPage = 1;
  bookPages = 1;
  bookTotal = 0;
  bookSearch = '';
  bookFrom = '';
  bookTo = '';
  busyBooking = '';
  bookings: BookingRow[] = [];
  bookFilter: 'paid' | 'all' | 'payment_review' | 'pending_payment' | 'completed' | 'cancelled' = 'paid';
  loadingBookings = false;
  bookingsError = '';

  ngOnInit() {
    const filter = this.route.snapshot.queryParamMap.get('filter');
    if (
      filter === 'paid' ||
      filter === 'all' ||
      filter === 'payment_review' ||
      filter === 'pending_payment' ||
      filter === 'completed' ||
      filter === 'cancelled'
    )
      this.bookFilter = filter;
    this.loadBookings();
  }

  ngOnDestroy() {
    this.alive = false;
  }

  setBookFilter(f: 'paid' | 'all' | 'payment_review') {
    this.bookFilter = f;
    this.bookPage = 1;
    this.loadBookings();
  }

  clearBookFilters() {
    this.bookSearch = '';
    this.bookFrom = '';
    this.bookTo = '';
    this.bookFilter = 'all';
    this.bookPage = 1;
    this.loadBookings();
  }

  goBookPage(page: number | string) {
    const target = Number(page);
    if (!Number.isInteger(target) || target < 1 || target > this.bookPages) return;
    this.bookPage = target;
    this.loadBookings();
  }

  loadBookings() {
    if (!this.auth.isAuthenticated) return;
    const request = ++this.workspace.bookingRequest;
    this.loadingBookings = true;
    this.bookingsError = '';
    this.bookingsApi
      .list({
        page: this.bookPage,
        status: this.bookFilter,
        q: this.bookSearch,
        from: this.bookFrom,
        to: this.bookTo
})
      .subscribe({
        next: (rows) => {
          if (request !== this.workspace.bookingRequest || !this.auth.isAuthenticated || !this.alive)
            return;
          this.bookings = rows.rows || rows || [];
          this.bookTotal = rows.total ?? this.bookings.length;
          this.bookPages = rows.pages || 1;
          this.bookPage = rows.page || 1;
          this.loadingBookings = false;
        },
        error: (e) => {
          if (request !== this.workspace.bookingRequest || !this.auth.isAuthenticated || !this.alive)
            return;
          this.loadingBookings = false;
          this.bookingsError = e.error?.error || 'Failed to load bookings';
        }
});
  }

  saveAssignment(b: BookingRow, completed = false) {
    if (this.busyBooking) return;
    this.busyBooking = b._id;
    const session = this.auth.session;
    this.bookingsApi.saveAssignment(b, completed).subscribe({
      next: () => {
        if (session !== this.auth.session) return;
        this.busyBooking = '';
        this.loadBookings();
        this.workspace.refreshStatus();
      },
      error: (e) => {
        if (session !== this.auth.session) return;
        this.busyBooking = '';
        this.bookingsError = e.error?.error || 'Could not save assignment.';
      }
});
  }
}
