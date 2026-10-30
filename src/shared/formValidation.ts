export function validationMessage(
  validity: ValidityState,
  min: string,
): string {
  if (validity.valueMissing) return "Please fill in this field.";
  if (validity.rangeUnderflow) return `Enter a value of at least ${min}.`;
  if (validity.stepMismatch) return "Enter a whole number.";
  if (validity.tooLong) return "This value is too long.";
  return "Please enter a valid value.";
}

export function showValidation(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.validity.customError)
    return;
  input.setCustomValidity(validationMessage(input.validity, input.min));
}

export function clearValidation(event: Event) {
  if (event.target instanceof HTMLInputElement)
    event.target.setCustomValidity("");
}
