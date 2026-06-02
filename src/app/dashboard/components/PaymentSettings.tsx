'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CheckIcon from '@mui/icons-material/Check';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import StarIcon from '@mui/icons-material/Star';

interface Plan {
  id: string;
  name: string;
  price: number;
  stores: string;
  staff: string;
  features: string[];
  recommended?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'フリープラン',
    price: 0,
    stores: '1店舗',
    staff: '最大10名',
    features: ['シフト希望収集', 'シフト表作成', '基本シフト最適化', 'PDF出力'],
  },
  {
    id: 'standard',
    name: 'スタンダード',
    price: 2980,
    stores: '3店舗まで',
    staff: '最大50名',
    features: ['フリープランの全機能', 'AI最適化シフト作成', '複数店舗管理', 'メールサポート'],
    recommended: true,
  },
  {
    id: 'pro',
    name: 'プロフェッショナル',
    price: 9800,
    stores: '無制限',
    staff: '無制限',
    features: ['スタンダードの全機能', '優先サポート', 'API連携', 'カスタム設定'],
  },
];

const CURRENT_PLAN_ID = 'free';

export default function PaymentSettings() {
  const currentPlan = PLANS.find(p => p.id === CURRENT_PLAN_ID)!;

  return (
    <Box sx={{ mb: 5, maxWidth: 900 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }} color="text.secondary">
        支払い管理
      </Typography>

      {/* 現在のプラン */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 4 }}>
        <Box sx={{ p: 2.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            現在のご利用プラン
          </Typography>
        </Box>
        <Box sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{currentPlan.name}</Typography>
                <Chip label="利用中" size="small" color="success" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {currentPlan.stores}・スタッフ{currentPlan.staff}
              </Typography>
            </Box>
            <Box sx={{ textAlign: { sm: 'right' } }}>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {currentPlan.price === 0 ? '無料' : `¥${currentPlan.price.toLocaleString()}`}
                {currentPlan.price > 0 && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                    /月
                  </Typography>
                )}
              </Typography>
              {currentPlan.price > 0 && (
                <Typography variant="caption" color="text.secondary">
                  次回請求日: ―
                </Typography>
              )}
            </Box>
          </Stack>
        </Box>
      </Paper>

      {/* プラン一覧 */}
      <Typography variant="body1" sx={{ fontWeight: 600, mb: 2 }}>
        プランを変更する
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 4 }}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === CURRENT_PLAN_ID;
          return (
            <Paper
              key={plan.id}
              variant="outlined"
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                borderColor: plan.recommended ? 'primary.main' : 'divider',
                borderWidth: plan.recommended ? 2 : 1,
              }}
            >
              {plan.recommended && (
                <Box sx={{ bgcolor: 'primary.main', px: 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StarIcon sx={{ fontSize: 14, color: 'white' }} />
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 700 }}>おすすめ</Typography>
                </Box>
              )}
              <Box sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>{plan.name}</Typography>
                <Box sx={{ mb: 0.25 }}>
                  <Typography component="span" variant="h5" sx={{ fontWeight: 800, color: plan.recommended ? 'primary.main' : 'text.primary' }}>
                    {plan.price === 0 ? '無料' : `¥${plan.price.toLocaleString()}`}
                  </Typography>
                  {plan.price > 0 && (
                    <Typography component="span" variant="caption" color="text.secondary"> /月</Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {plan.stores}・{plan.staff}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={0.75} sx={{ mb: 2 }}>
                  {plan.features.map(f => (
                    <Stack key={f} direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
                      <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      <Typography variant="caption" color="text.secondary">{f}</Typography>
                    </Stack>
                  ))}
                </Stack>
                <Button
                  variant={isCurrent ? 'outlined' : plan.recommended ? 'contained' : 'outlined'}
                  color={plan.recommended ? 'primary' : 'inherit'}
                  size="small"
                  fullWidth
                  disabled={isCurrent}
                >
                  {isCurrent ? '利用中' : 'このプランに変更'}
                </Button>
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* お支払い方法 */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 4 }}>
        <Box sx={{ p: 2.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <CreditCardIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              お支払い方法
            </Typography>
          </Stack>
        </Box>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
            有料プランにアップグレードするとお支払い方法を登録できます
          </Typography>
          <Button variant="outlined" size="small" startIcon={<CreditCardIcon />} disabled>
            お支払い方法を追加
          </Button>
        </Box>
      </Paper>

      {/* 請求履歴 */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 2.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
            <ReceiptLongIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              請求履歴
            </Typography>
          </Stack>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                {['請求日', 'プラン', '金額', '状態', ''].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: 11, color: 'text.secondary' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.disabled">請求履歴はありません</Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
