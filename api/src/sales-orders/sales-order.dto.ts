import { SalesOrderStatus } from '../domain/statuses';

export class SalesOrderDto {
  no!: string;
  customerNo!: string;
  customerName!: string;
  deliveryCity!: string;
  totalWeightKg!: number;
  status!: SalesOrderStatus;
}
