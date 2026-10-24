/** Source of "today" for business rules; injectable so tests can freeze time. */
export abstract class Clock {
  /** Today's date as YYYY-MM-DD in the business time zone. */
  abstract today(): string;
}

export class ZonedClock extends Clock {
  private readonly format: Intl.DateTimeFormat;

  constructor(
    timeZone: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    super();
    // en-CA formats dates as YYYY-MM-DD.
    this.format = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  today(): string {
    return this.format.format(this.now());
  }
}
