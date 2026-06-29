import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { IdentityValidator } from '../validators/identity.validator';

@ValidatorConstraint({ async: false })
export class IsEcuadorianRucConstraint implements ValidatorConstraintInterface {
  validate(ruc: string) {
    return IdentityValidator.isValidRuc(ruc);
  }

  defaultMessage() {
    return 'El RUC ingresado no es válido según las reglas del SRI de Ecuador';
  }
}

export function IsEcuadorianRuc(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsEcuadorianRucConstraint,
    });
  };
}
