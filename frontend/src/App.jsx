import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:5050';

const vehicles = [
  {
    id: 'hatchback',
    name: 'Hatchback',
    detail: 'Compact • 3 seats',
    price: 249,
    time: '6 min',
    icon: '🚗',
  },
  {
    id: 'sedan',
    name: 'Sedan',
    detail: 'Comfort • 4 seats',
    price: 349,
    time: '5 min',
    icon: '🚘',
  },
  {
    id: 'suv',
    name: 'SUV',
    detail: 'Spacious • 6 seats',
    price: 499,
    time: '8 min',
    icon: '🚙',
  },
];

const initialJourney = {
  trainNumber: '12046',
  trainName: 'Chandigarh – New Delhi Shatabdi',
  from: 'Chandigarh Junction (CDG)',
  to: 'New Delhi (NDLS)',
  arrival: '18:35',
  platform: 'Platform 2',
};

const statusSteps = [
  'DRIVER_ASSIGNED',
  'ACCEPTED',
  'ON_THE_WAY',
  'ARRIVED',
  'PICKED_UP',
  'COMPLETED',
];

const statusLabels = {
  DRIVER_ASSIGNED: 'Driver Assigned',
  ACCEPTED: 'Ride Accepted',
  ON_THE_WAY: 'Driver On The Way',
  ARRIVED: 'Driver Arrived',
  PICKED_UP: 'Passenger Picked Up',
  COMPLETED: 'Ride Completed',
  CANCELLED: 'Booking Cancelled',
};

function formatTime(date) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return '--:--';

  return parsed.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function App() {
  const [journey, setJourney] = useState(initialJourney);
  const [journeyType, setJourneyType] = useState('train');
  const [dropLocation, setDropLocation] = useState(
    'Connaught Place, New Delhi'
  );

  const [searched, setSearched] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('sedan');

  const [booking, setBooking] = useState(null);
  const [delay, setDelay] = useState(0);

  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const [travelDate, setTravelDate] = useState(
    new Date().toLocaleDateString('en-CA')
  );

  const [trainData, setTrainData] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [allBookings, setAllBookings] = useState([]);

  const [activeTab, setActiveTab] = useState('passenger');
  const [tracking, setTracking] = useState(false);

  const vehicle = useMemo(
    () =>
      vehicles.find((item) => item.id === selectedVehicle) ||
      vehicles[1],
    [selectedVehicle]
  );

  const availableDrivers = drivers.filter(
    (driver) => driver.available
  );

  async function apiRequest(endpoint, options = {}) {
    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        ...options,
        headers: {
          ...(options.body
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...options.headers,
        },
      }
    );

    const result = await response.json();

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || 'Something went wrong.'
      );
    }

    return result;
  }

  async function fetchDrivers() {
    try {
      const result = await apiRequest('/api/drivers');
      setDrivers(result.drivers || []);
    } catch (error) {
      console.error('Driver fetch error:', error.message);
    }
  }

  async function fetchBookings() {
    try {
      const result = await apiRequest('/api/bookings');
      setAllBookings(result.bookings || []);
    } catch (error) {
      console.error('Booking fetch error:', error.message);
    }
  }

  // Refresh fleet and booking information periodically.
  useEffect(() => {
    fetchDrivers();
    fetchBookings();

    const interval = setInterval(() => {
      fetchDrivers();
      fetchBookings();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Refresh current booking from backend.
  useEffect(() => {
    if (!booking?.id) return;

    const interval = setInterval(async () => {
      try {
        const result = await apiRequest(
          `/api/bookings/${booking.id}`
        );

        setBooking(result.booking);
      } catch (error) {
        console.error(error.message);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [booking?.id]);

  async function handleSearch(event) {
    event.preventDefault();

    if (journeyType !== 'train') {
      setNotice(
        'Live flight tracking is not integrated yet. Please select Train.'
      );
      return;
    }

    if (!journey.trainNumber.trim()) {
      setNotice('Please enter a train number.');
      return;
    }

    setLoading(true);
    setBooking(null);
    setDelay(0);
    setTrainData(null);
    setNotice('');

    try {
      const result = await apiRequest(
        `/api/train/${encodeURIComponent(
          journey.trainNumber.trim()
        )}`
      );

      const data = result.data || result;
      const train = data.train || {};

      setTrainData(data);

      setJourney((previous) => ({
        ...previous,
        trainName:
          data.trainName ||
          train.name ||
          previous.trainName,
        from: train.source?.name || previous.from,
        to: train.destination?.name || previous.to,
      }));

      setSearched(true);

      setNotice(
        `Train information retrieved. Status: ${
          data.status || 'Information received'
        }.`
      );
    } catch (error) {
      setSearched(false);
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function simulateDelay() {
    const newDelay = delay === 0 ? 25 : delay + 10;

    setDelay(newDelay);

    if (booking?.bookingId) {
      try {
        const result = await apiRequest(
          `/api/bookings/${booking.bookingId}/train-delay`,
          {
            method: 'POST',
            body: JSON.stringify({
              delayMinutes: newDelay,
            }),
          }
        );

        setBooking(result.booking);

        setNotice(
          `Train delay updated by ${newDelay} minutes. Dispatch schedule recalculated by backend.`
        );
      } catch (error) {
        setNotice(error.message);
      }
    } else {
      setNotice(
        `Demo delay of ${newDelay} minutes applied. Confirm your ride to create a booking with this updated arrival time.`
      );
    }
  }

  async function bookRide() {
    if (!searched) {
      setNotice('Please search for your journey first.');
      return;
    }

    if (!dropLocation.trim()) {
      setNotice('Please enter your destination.');
      return;
    }

    setLoading(true);
    setNotice('');

    try {
      const [hours, minutes] = journey.arrival
        .split(':')
        .map(Number);

      const arrivalDateTime = new Date(
        `${travelDate}T${String(hours).padStart(2, '0')}:${String(
          minutes
        ).padStart(2, '0')}:00`
      );

      if (Number.isNaN(arrivalDateTime.getTime())) {
        throw new Error('Invalid journey arrival time.');
      }

      arrivalDateTime.setMinutes(
        arrivalDateTime.getMinutes() + delay
      );

      const result = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          passengerName: 'RideSync Passenger',
          trainNumber: journey.trainNumber,
          trainName: journey.trainName,
          arrivalStation: journey.to,
          destination: dropLocation,
          arrivalTime: arrivalDateTime.toISOString(),
          vehicle: vehicle.name,
          fare: vehicle.price,
        }),
      });

      setBooking(result.booking);
      setTracking(false);

      setNotice(
        `RideSync booking confirmed! Booking ID: ${result.booking.bookingId}`
      );

      await fetchDrivers();
      await fetchBookings();

    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateRideStatus(bookingId, status) {
    try {
      setLoading(true);

      const result = await apiRequest(
        `/api/bookings/${bookingId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }
      );

      if (booking?.bookingId === bookingId) {
        setBooking(result.booking);
      }

      setNotice(result.message);

      await fetchDrivers();
      await fetchBookings();

    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  function resetDemo() {
    setSearched(false);
    setBooking(null);
    setDelay(0);
    setTracking(false);
    setTrainData(null);
    setNotice('Demo reset. Start a new journey.');
  }

  function nextStatus(status) {
    const index = statusSteps.indexOf(status);

    if (index < 0 || index >= statusSteps.length - 1) {
      return null;
    }

    return statusSteps[index + 1];
  }

  function renderDriverDashboard() {
    return (
      <section className="booking-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">DRIVER WORKSPACE</div>
            <h2>Driver Dashboard</h2>
          </div>

          <button
            className="secondary-button"
            onClick={() => {
              fetchDrivers();
              fetchBookings();
            }}
          >
            ↻ Refresh
          </button>
        </div>

        <div className="dispatch-metrics">
          <div>
            <strong>{drivers.length}</strong>
            <small>Total Drivers</small>
          </div>

          <div>
            <strong>{availableDrivers.length}</strong>
            <small>Available Drivers</small>
          </div>

          <div>
            <strong>{allBookings.length}</strong>
            <small>Total Bookings</small>
          </div>
        </div>

        <h3 className="dashboard-subheading">
          In-House Fleet
        </h3>

        <div className="vehicle-options">
          {drivers.map((driver) => (
            <div className="vehicle-option" key={driver.id}>
              <span className="vehicle-icon">🚘</span>

              <span className="vehicle-info">
                <b>{driver.name}</b>
                <small>
                  {driver.vehicle} · {driver.plate}
                </small>
                <small>
                  Rating: ★ {driver.rating} · {driver.distance} km away
                </small>
              </span>

              <strong
                style={{
                  color: driver.available
                    ? '#22c99a'
                    : '#e5a14b',
                }}
              >
                {driver.available ? 'Available' : 'Busy'}
              </strong>
            </div>
          ))}
        </div>

        <h3 className="dashboard-subheading">
          Booking Management
        </h3>

        {allBookings.length === 0 ? (
          <div className="result-card">
            No bookings have been created yet.
          </div>
        ) : (
          allBookings.map((item) => (
            <div
              className="result-card driver-card"
              key={item.bookingId}
            >
              <div className="card-topline">
                <span className="status-tag assigned">
                  <i /> {statusLabels[item.status] || item.status}
                </span>

                <span className="muted-small">
                  {item.bookingId}
                </span>
              </div>

              <div className="driver-main">
                <div className="driver-avatar">
                  {item.driver?.name
                    ?.split(' ')
                    .map((part) => part[0])
                    .join('')}
                </div>

                <div className="driver-details">
                  <h3>{item.driver?.name}</h3>
                  <p>{item.driver?.vehicle}</p>
                  <strong>{item.driver?.plate}</strong>
                </div>

                <div className="driver-eta">
                  <b>₹{item.fare}</b>
                  <small>{item.vehicle}</small>
                </div>
              </div>

              <div className="pickup-banner">
                <span>📍</span>
                <div>
                  <b>{item.destination}</b>
                  <small>
                    Train {item.trainNumber} · {item.arrivalStation}
                  </small>
                </div>
              </div>

              <div className="driver-actions">
                {nextStatus(item.status) && (
                  <button
                    className="primary-button"
                    disabled={loading}
                    onClick={() =>
                      updateRideStatus(
                        item.bookingId,
                        nextStatus(item.status)
                      )
                    }
                  >
                    {nextStatus(item.status) === 'ACCEPTED'
                      ? 'Accept Ride'
                      : `Update: ${statusLabels[nextStatus(item.status)]}`}
                    <span>→</span>
                  </button>
                )}

                {item.status === 'DRIVER_ASSIGNED' ||
                item.status === 'ACCEPTED' ||
                item.status === 'ON_THE_WAY' ||
                item.status === 'ARRIVED' ? (
                  <button
                    className="secondary-button"
                    disabled={loading}
                    onClick={() =>
                      updateRideStatus(
                        item.bookingId,
                        'CANCELLED'
                      )
                    }
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </section>
    );
  }

  function renderPassengerDashboard() {
    return (
      <>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow">
              <span>✦</span> TRAIN TRACKING + STATION PICKUPS
            </div>

            <h1>
              Your train arrives.
              <br />
              <em>Your ride is ready.</em>
            </h1>

            <p className="hero-description">
              Track your train and book a reliable station pickup.
              One simple journey, from platform to destination.
            </p>

            <div className="hero-actions">
              <a className="primary-button" href="#journey">
                Book your ride <span>↗</span>
              </a>

              <a className="text-button" href="#how-it-works">
                See how it works <span>↓</span>
              </a>
            </div>

            <div className="trust-row">
              <span>✓</span> Smart dispatch
              <b>•</b> In-house fleet
              <b>•</b> Less waiting
            </div>
          </div>

          <div className="hero-visual">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />

            <div className="visual-label label-train">
              <span>🚆</span>
              <div>
                <b>Journey tracked</b>
                <small>Train information connected</small>
              </div>
            </div>

            <div className="route-line">
              <span />
              <span />
              <span />
            </div>

            <div className="visual-car">🚖</div>

            <div className="visual-label label-cab">
              <span>✦</span>
              <div>
                <b>Your ride, ready</b>
                <small>RideSync fleet coordination</small>
              </div>
            </div>

            <div className="visual-caption">
              FROM PLATFORM TO PICKUP
            </div>
          </div>
        </section>

        <section className="booking-section" id="journey">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                ONE CONNECTED JOURNEY
              </div>
              <h2>Plan your pickup</h2>
            </div>

            <span className="step-indicator">
              01 <i /> 02 <i /> 03
            </span>
          </div>

          <form
            className="journey-form"
            onSubmit={handleSearch}
          >
            <label className="field">
              <span>JOURNEY TYPE</span>
              <select
                value={journeyType}
                onChange={(event) =>
                  setJourneyType(event.target.value)
                }
              >
                <option value="train">🚆 Train arrival</option>
                <option value="flight">✈ Flight arrival</option>
              </select>
            </label>

            <label className="field">
              <span>
  {journeyType === 'flight' ? 'FLIGHT NUMBER' : 'TRAIN NUMBER'}
</span>
              <input
                value={journey.trainNumber}
                onChange={(event) =>
                  setJourney({
                    ...journey,
                    trainNumber: event.target.value,
                  })
                }
                required
                placeholder="e.g. 12046"
              />
            </label>

            <label className="field">
              <span>
  {journeyType === 'flight' ? 'ARRIVAL AIRPORT' : 'ARRIVAL STATION'}
</span>
              <input
                value={journey.to}
                onChange={(event) =>
                  setJourney({
                    ...journey,
                    to: event.target.value,
                  })
                }
                required
                placeholder="Destination station"
              />
            </label>

            <label className="field">
              <span>FINAL DESTINATION</span>
              <input
                value={dropLocation}
                onChange={(event) =>
                  setDropLocation(event.target.value)
                }
                required
                placeholder="Where do you want to go?"
              />
            </label>

            <label className="field">
              <span>TRAVEL DATE</span>
              <input
                type="date"
                value={travelDate}
                onChange={(event) =>
                  setTravelDate(event.target.value)
                }
                required
              />
            </label>

            <button
              className="search-button"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Fetching train...' : 'Find my ride'}
              <span>→</span>
            </button>
          </form>

          <div className="demo-note">
            <span>ⓘ</span>
            RailRadar provides train information. The current
            app uses an estimated arrival time until
            actual route ETA extraction is implemented.
          </div>

          {searched && (
            <div className="results-area">
              <div className="result-card journey-card">
                <div className="card-topline">
                  <span className="status-tag">
                    <i /> TRAIN INFORMATION RETRIEVED
                  </span>

                  <span className="muted-small">
                    TRAIN {journey.trainNumber}
                  </span>
                </div>

                <h3>{journey.trainName}</h3>

                <div className="journey-route">
                  <div>
                    <strong>{journey.from}</strong>
                    <b>Origin</b>
                  </div>

                  <div className="route-middle">
                    <span>🚆</span>
                    <i />
                  </div>

                  <div>
                    <strong>{journey.to}</strong>
                    <b>{initialJourney.platform}</b>
                  </div>
                </div>

                <div className="arrival-row">
                  <div>
                    <span>DISPLAYED ARRIVAL TIME</span>
                    <strong>
                      {(() => {
                        const [h, m] = journey.arrival
                          .split(':')
                          .map(Number);

                        const date = new Date();
                        date.setHours(h, m + delay, 0, 0);

                        return formatTime(date);
                      })()}
                    </strong>
                  </div>

                  <div className="arrival-status">
                    <span className={delay ? 'delayed' : ''}>
                      {delay
                        ? `Demo delay: ${delay} min`
                        : trainData?.status || 'Train data received'}
                    </span>

                    <small>
                      {delay
                        ? 'Dispatch calculation updated'
                        : 'Arrival time is illustrative'}
                    </small>
                  </div>
                </div>

                <button
                  className="simulate-button"
                  type="button"
                  onClick={simulateDelay}
                >
                  ↻ Simulate +25 min train delay
                </button>
              </div>

              <div className="vehicle-panel">
                <div className="vehicle-heading">
                  <div>
                    <span className="eyebrow">
                      RIDESYNC IN-HOUSE FLEET
                    </span>
                    <h3>Choose your vehicle</h3>
                  </div>

                  <span className="muted-small">
                    ESTIMATED FARE
                  </span>
                </div>

                <div className="vehicle-options">
                  {vehicles.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`vehicle-option ${
                        selectedVehicle === item.id
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() =>
                        setSelectedVehicle(item.id)
                      }
                    >
                      <span className="vehicle-icon">
                        {item.icon}
                      </span>

                      <span className="vehicle-info">
                        <b>{item.name}</b>
                        <small>{item.detail}</small>
                        <small>
                          Pickup estimate: {item.time}
                        </small>
                      </span>

                      <strong>₹{item.price}</strong>
                      <span className="radio-dot" />
                    </button>
                  ))}
                </div>

                <div className="booking-footer">
                  <span>
                    <small>FARE ESTIMATE</small>
                    <strong>₹{vehicle.price}</strong>
                  </span>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={bookRide}
                    disabled={loading}
                  >
                    {loading ? 'Assigning driver...' : 'Book Ride'}
                    <span>→</span>
                  </button>
                </div>

                <div className="demo-note">
                  RideSync automatically selects an available
                  driver from its demo fleet.
                </div>
              </div>
            </div>
          )}

          {booking && (
            <div className="result-card driver-card">
              <div className="card-topline">
                <span className="status-tag assigned">
                  <i /> {statusLabels[booking.status] || booking.status}
                </span>

                <span className="muted-small">
                  BOOKING {booking.bookingId}
                </span>
              </div>

              <h2>Your RideSync Booking</h2>

              <div className="driver-main">
                <div className="driver-avatar">
                  {booking.driver?.name
                    ?.split(' ')
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)}
                </div>

                <div className="driver-details">
                  <h3>{booking.driver?.name}</h3>
                  <p>
                    ★ {booking.driver?.rating} rating ·{' '}
                    {booking.driver?.vehicle}
                  </p>
                  <strong>{booking.driver?.plate}</strong>
                </div>

                <div className="driver-eta">
                  <b>₹{booking.fare}</b>
                  <small>Estimated fare</small>
                </div>
              </div>

              <div className="pickup-banner">
                <span>✦</span>
                <div>
                  <b>Driver successfully allocated!</b>
                  <small>
                    Your RideSync cab is assigned for {dropLocation}.
                  </small>
                </div>
              </div>

              <div className="dispatch-engine">
                <div className="dispatch-header">
                  <div>
                    <span className="eyebrow">
                      RIDESYNC INTELLIGENCE
                    </span>
                    <h3>Smart Dispatch Engine</h3>
                  </div>

                  <span className="engine-status">
                    ● ACTIVE
                  </span>
                </div>

                <div className="dispatch-timeline">
                  <div className="dispatch-item">
                    <span className="dispatch-icon">🚕</span>
                    <div>
                      <small>DRIVER DISPATCH</small>
                      <strong>{formatTime(booking.dispatchTime)}</strong>
                    </div>
                  </div>

                  <div className="dispatch-connector" />

                  <div className="dispatch-item">
                    <span className="dispatch-icon">🚆</span>
                    <div>
                      <small>EXPECTED TRAIN ARRIVAL</small>
                      <strong>{formatTime(booking.arrivalTime)}</strong>
                    </div>
                  </div>
                </div>

                <div className="dispatch-explanation">
                  <span>✦</span>
                  Dispatch schedule calculated by the RideSync
                  backend using arrival time and a travel buffer.
                </div>
              </div>

              <h3 className="dashboard-subheading">
                Booking Progress
              </h3>

              <div className="dispatch-metrics">
                {statusSteps.map((status) => {
                  const currentIndex = statusSteps.indexOf(
                    booking.status
                  );

                  const stepIndex = statusSteps.indexOf(status);

                  const completed = currentIndex >= stepIndex;

                  return (
                    <div key={status}>
                      <strong
                        style={{
                          color: completed ? '#22c99a' : '#87919c',
                        }}
                      >
                        {completed ? '✓' : '○'}
                      </strong>
                      <small>{statusLabels[status]}</small>
                    </div>
                  );
                })}
              </div>

              <div className="driver-actions">
                <button
                  className="primary-button"
                  onClick={() => setTracking(!tracking)}
                >
                  {tracking ? 'Hide trip view' : 'View trip progress'}
                  <span>→</span>
                </button>

                <button
                  className="secondary-button"
                  onClick={resetDemo}
                >
                  New Journey
                </button>
              </div>

              {tracking && (
                <div className="tracking-panel">
                  <div className="tracking-map">
                    <div className="map-road road-a" />
                    <div className="map-road road-b" />
                    <div className="map-pin pin-driver">🚕</div>
                    <div className="map-pin pin-destination">📍</div>
                    <div className="map-route-line" />
                  </div>

                  <div>
                    <b>Ride progress</b>
                    <p>
                      Driver location is simulated for this
                      booking experience.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {notice && (
            <p className="notice-message" role="status">
              {notice}
            </p>
          )}
        </section>

        <section className="how-section" id="how-it-works">
          <div className="eyebrow">SIMPLE BY DESIGN</div>

          <h2>
            From arrival to onward, <em>in sync.</em>
          </h2>

          <div className="steps-grid">
            <article>
              <span>01</span>
              <div className="step-icon">🎫</div>
              <h3>Share your journey</h3>
              <p>
                Add your train details and final destination.
              </p>
            </article>

            <article>
              <span>02</span>
              <div className="step-icon">⏱</div>
              <h3>We sync your arrival</h3>
              <p>
                RideSync calculates arrival and dispatch timing.
              </p>
            </article>

            <article>
              <span>03</span>
              <div className="step-icon">🚖</div>
              <h3>Your ride is assigned</h3>
              <p>
                Our in-house fleet assigns an available driver.
              </p>
            </article>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="ridesync-app">
      <aside className="app-sidebar">
        <a className="brand sidebar-brand" href="#home" onClick={() => setActiveTab('passenger')}>
          <span className="brand-mark">🚆</span>
          <span>Ride<span className="brand-accent">Sync</span></span>
        </a>
        <div className="sidebar-label">YOUR WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <button className={activeTab === 'passenger' ? 'selected' : ''} onClick={() => setActiveTab('passenger')}>⌂ <span>Passenger dashboard</span></button>
          <a href="#journey" onClick={() => setActiveTab('passenger')}>🚕 <span>Book a ride</span></a>
          <a href="#journey" onClick={() => setActiveTab('passenger')}>▤ <span>My bookings</span></a>
          <a href="#journey" onClick={() => setActiveTab('passenger')}>🚆 <span>Train tracker</span></a>
          <button className={activeTab === 'driver' ? 'selected' : ''} onClick={() => setActiveTab('driver')}>▦ <span>Driver dashboard</span></button>
        </nav>
        <div className="sidebar-bottom"><span className="sidebar-dot" /> Station-to-door journeys, simplified.</div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="topbar-title"><strong>{activeTab === 'driver' ? 'Driver dashboard' : 'Welcome to RideSync'}</strong><small>{activeTab === 'driver' ? 'Manage your fleet and bookings' : 'Your train and cab, in one place'}</small></div>
          <div className="topbar-right"><span className="connection-indicator">● RideSync</span><span className="profile-avatar">RS</span></div>
        </header>
        <main id="home">
          {activeTab === 'passenger' ? renderPassengerDashboard() : renderDriverDashboard()}
        </main>
        <footer className="footer"><span>© 2026 RideSync</span><span>From platform to pickup.</span></footer>
      </div>
    </div>
  );
}

export default App;
