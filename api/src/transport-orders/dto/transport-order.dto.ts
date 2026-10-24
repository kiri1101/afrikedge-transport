import { OrderAction } from '../../domain/rules';
import { TransportOrderStatus } from '../../domain/statuses';
import { SalesOrderDto } from '../../sales-orders/sales-order.dto';

export class TransportOrderSummaryDto {
  no!: string;
  /** rowversion as 16 hex characters; send it back in If-Match. */
  version!: string;
  status!: TransportOrderStatus;
  /** YYYY-MM-DD */
  deliveryDate!: string;
  vehicleCode!: string;
  plateNo!: string;
  capacityKg!: number;
  lineCount!: number;
  totalWeightKg!: number;
  createdBy!: string;
  validatedBy!: string | null;
}

export class TransportOrderDetailDto extends TransportOrderSummaryDto {
  remainingKg!: number;
  lines!: SalesOrderDto[];
  /** What the current user may do on this order now. */
  allowedActions!: OrderAction[];
}
