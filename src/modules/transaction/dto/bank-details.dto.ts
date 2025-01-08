export class BankDetailsDto {
  bankName: string;
  accountNumber: string;
  accountName: string;

  static fromMessage(message: string): BankDetailsDto | null {
    const lines = message.split('\n');
    const details = new BankDetailsDto();
    
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      
      switch (key.toLowerCase()) {
        case 'bank name':
          details.bankName = value;
          break;
        case 'account number':
          details.accountNumber = value;
          break;
        case 'account name':
          details.accountName = value;
          break;
      }
    }

    if (details.bankName && details.accountNumber && details.accountName) {
      return details;
    }
    return null;
  }
} 