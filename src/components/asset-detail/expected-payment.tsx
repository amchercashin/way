import type { PaymentSchedule } from '@/models/types';

interface ExpectedPaymentProps {
  schedule: PaymentSchedule;
  quantity: number;
}

export function ExpectedPayment({ schedule, quantity }: ExpectedPaymentProps) {
  const totalAmount = schedule.lastPaymentAmount * quantity;

  const formatDate = (date?: Date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="bg-gradient-to-br from-[#1a2e1a] to-[#1a1a2e] border border-[#4ecca333] rounded-xl p-3.5 mt-3">
      <div className="text-[#4ecca3] text-xs font-semibold mb-2">Ожидаемый дивиденд</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Размер (прогноз)</span>
          <span className="text-white">
            ₽{schedule.lastPaymentAmount} × {quantity} = ₽{Math.round(totalAmount).toLocaleString('ru-RU')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Отсечка (ожид.)</span>
          <span className="text-white">{formatDate(schedule.nextExpectedCutoffDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Выплата (ожид.)</span>
          <span className="text-white">{formatDate(schedule.nextExpectedDate)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Зачисление (ожид.)</span>
          <span className="text-white">{formatDate(schedule.nextExpectedCreditDate)}</span>
        </div>
      </div>
      <div className="text-gray-600 text-[10px] mt-2">На основе последней выплаты</div>
    </div>
  );
}
