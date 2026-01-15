import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { LeaveType } from '@prisma/client';

// Custom validator to ensure fromDate <= toDate
function IsValidDateRange(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidDateRange',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const fromDate = (args.object as any).fromDate;
          const toDate = (args.object as any).toDate;
          if (!fromDate || !toDate) return true; // Let other validators handle missing values
          const from = new Date(fromDate);
          const to = new Date(toDate);
          from.setHours(0, 0, 0, 0);
          to.setHours(0, 0, 0, 0);
          return to >= from;
        },
        defaultMessage(args: ValidationArguments) {
          return 'toDate must be greater than or equal to fromDate';
        },
      },
    });
  };
}

// Custom validator to ensure dates are not in the past (for regular users)
function IsNotPastDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isNotPastDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!value) return true; // Let other validators handle missing values
          const date = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          date.setHours(0, 0, 0, 0);
          return date >= today;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not be in the past`;
        },
      },
    });
  };
}

// Custom validator to ensure both dates are in the same year
function IsSameYear(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isSameYear',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const fromDate = (args.object as any).fromDate;
          const toDate = (args.object as any).toDate;
          if (!fromDate || !toDate) return true; // Let other validators handle missing values
          const from = new Date(fromDate);
          const to = new Date(toDate);
          return from.getFullYear() === to.getFullYear();
        },
        defaultMessage(args: ValidationArguments) {
          return 'fromDate and toDate must be in the same calendar year';
        },
      },
    });
  };
}

export class ApplyLeaveDto {
  @IsEnum(LeaveType)
  @IsNotEmpty()
  type: LeaveType;

  @IsDateString()
  @IsNotEmpty()
  @IsNotPastDate()
  @IsSameYear()
  fromDate: Date;

  @IsDateString()
  @IsNotEmpty()
  @IsValidDateRange()
  @IsNotPastDate()
  @IsSameYear()
  toDate: Date;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  status: string;
}
