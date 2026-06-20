import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Box, Paper, Typography, TextField, Button, Alert, Link, Divider, alpha, useMediaQuery, useTheme } from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { motion } from 'framer-motion';
import Diversity3 from '@mui/icons-material/Diversity3';
import { useAuth } from '../../contexts/AuthContext';
import AuthHeroAnimation from '../../components/AuthHeroAnimation';

interface FormData { firstName: string; lastName: string; email: string; password: string; confirmPassword: string; }

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      await registerUser(data.firstName, data.lastName, data.email, data.password);
      // FR-1.6: the user must confirm their email before logging in.
      setSuccess('Регистрацијата е успешна! Проверете го вашиот email за потврда, потоа најавете се.');
      setTimeout(() => navigate('/login?registered=true'), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Грешка при регистрација.');
    }
  };

  const darkInputSx = {
    '& .MuiOutlinedInput-root': {
      color: 'white',
      '& fieldset': { borderColor: alpha('#fff', 0.2) },
      '&:hover fieldset': { borderColor: alpha('#fff', 0.4) },
      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
    },
    '& .MuiInputLabel-root': { color: alpha('#fff', 0.8) },
    '& .MuiInputLabel-root.Mui-focused': { color: '#3b82f6' },
    '& .MuiFormHelperText-root': { color: alpha('#fff', 0.5) },
  };

  return (
    <Box
      display="flex"
      minHeight="100vh"
      sx={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', position: 'relative' }}
    >
      {/* Top-left "Дознај повеќе" button */}
      <Box sx={{ position: 'absolute', top: 24, left: 24, zIndex: 50 }}>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <Button
            component={RouterLink} to="/"
            startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
            sx={{
              color: alpha('#fff', 0.7),
              border: `1px solid ${alpha('#fff', 0.15)}`,
              borderRadius: 3,
              px: 2.5, py: 0.75,
              backdropFilter: 'blur(12px)',
              bgcolor: alpha('#fff', 0.05),
              fontWeight: 600,
              fontSize: '0.85rem',
              textTransform: 'none',
              letterSpacing: 0.5,
              '&:hover': { bgcolor: alpha('#fff', 0.1), borderColor: alpha('#fff', 0.3), color: 'white' },
            }}
          >
            Дознај повеќе
          </Button>
        </motion.div>
      </Box>
      {/* Left: Animated Hero */}
      {!isMobile && (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #0f172a 0%, #1a2332 50%, #0f172a 100%)',
          }}
        >
          <AuthHeroAnimation />
        </Box>
      )}

      {/* Right: Register Form */}
      <Box
        sx={{
          width: isMobile ? '100%' : 560,
          minWidth: isMobile ? undefined : 480,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4 },
          background: isMobile
            ? 'linear-gradient(135deg, #059669 0%, #1e3a5f 50%, #1a56db 100%)'
            : `linear-gradient(180deg, ${alpha('#0f172a', 0.95)}, ${alpha('#1e293b', 0.98)})`,
          borderLeft: isMobile ? 'none' : `1px solid ${alpha('#1a56db', 0.15)}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background accents */}
        {!isMobile && (
          <>
            <Box
              component={motion.div}
              animate={{ opacity: [0.03, 0.08, 0.03] }}
              // @ts-ignore
              transition={{ duration: 6, repeat: Infinity }}
              sx={{
                position: 'absolute', top: -100, right: -100, width: 400, height: 400,
                borderRadius: '50%', background: 'radial-gradient(circle, #059669, transparent)',
              }}
            />
            <Box
              component={motion.div}
              animate={{ opacity: [0.03, 0.06, 0.03] }}
              // @ts-ignore
              transition={{ duration: 8, repeat: Infinity, delay: 3 }}
              sx={{
                position: 'absolute', bottom: -80, left: -80, width: 300, height: 300,
                borderRadius: '50%', background: 'radial-gradient(circle, #1a56db, transparent)',
              }}
            />
          </>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 4,
              bgcolor: isMobile ? 'background.paper' : alpha('#fff', 0.04),
              backdropFilter: isMobile ? 'none' : 'blur(20px)',
              border: isMobile ? 'none' : `1px solid ${alpha('#fff', 0.08)}`,
              boxShadow: isMobile ? '0 25px 50px rgba(0,0,0,0.2)' : `0 25px 50px ${alpha('#000', 0.3)}`,
            }}
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}>
              <Box
                sx={{
                  width: 64, height: 64, borderRadius: 3,
                  background: 'linear-gradient(135deg, #059669, #1a56db)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mx: 'auto', mb: 2,
                  boxShadow: '0 8px 32px rgba(5,150,105,0.3)',
                }}
              >
                <Diversity3 sx={{ color: 'white', fontSize: 32 }} />
              </Box>
            </motion.div>

            <Typography
              variant="h5"
              textAlign="center"
              fontWeight={700}
              mb={0.5}
              sx={{ color: isMobile ? 'text.primary' : 'white' }}
            >
              Создадете сметка
            </Typography>
            <Typography
              variant="body2"
              textAlign="center"
              mb={3}
              sx={{ color: isMobile ? 'text.secondary' : alpha('#fff', 0.6) }}
            >
              Придружете се на спортската заедница
            </Typography>

            {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert></motion.div>}
            {success && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{success}</Alert></motion.div>}

            <form onSubmit={handleSubmit(onSubmit)}>
              <Box display="flex" gap={2}>
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} style={{ flex: 1 }}>
                  <TextField fullWidth label="Име" margin="normal"
                    {...register('firstName', { required: 'Името е задолжително' })}
                    error={!!errors.firstName} helperText={errors.firstName?.message} sx={isMobile ? undefined : darkInputSx} />
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }} style={{ flex: 1 }}>
                  <TextField fullWidth label="Презиме" margin="normal"
                    {...register('lastName', { required: 'Презимето е задолжително' })}
                    error={!!errors.lastName} helperText={errors.lastName?.message} sx={isMobile ? undefined : darkInputSx} />
                </motion.div>
              </Box>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <TextField fullWidth label="Email" margin="normal"
                  {...register('email', { required: 'Email е задолжителен', pattern: { value: /^\S+@\S+$/i, message: 'Невалиден email' } })}
                  error={!!errors.email} helperText={errors.email?.message} sx={isMobile ? undefined : darkInputSx} />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
                <TextField fullWidth label="Лозинка" type="password" margin="normal"
                  {...register('password', { required: 'Лозинката е задолжителна', minLength: { value: 8, message: 'Минимум 8 карактери' },
                    pattern: { value: /^(?=.*[A-Z])(?=.*\d)/, message: 'Мора да содржи голема буква и цифра' } })}
                  error={!!errors.password} helperText={errors.password?.message} sx={isMobile ? undefined : darkInputSx} />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                <TextField fullWidth label="Потврди лозинка" type="password" margin="normal"
                  {...register('confirmPassword', { required: 'Потврдете ја лозинката',
                    validate: (val) => val === watch('password') || 'Лозинките не се совпаѓаат' })}
                  error={!!errors.confirmPassword} helperText={errors.confirmPassword?.message} sx={isMobile ? undefined : darkInputSx} />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                <Button fullWidth variant="contained" type="submit" disabled={isSubmitting}
                  size="large"
                  sx={{
                    mt: 2, mb: 2, py: 1.5,
                    background: 'linear-gradient(135deg, #059669, #1a56db)',
                    '&:hover': { background: 'linear-gradient(135deg, #064e3b, #1e3a5f)' },
                    fontWeight: 600,
                    fontSize: '1rem',
                  }}>
                  {isSubmitting ? 'Се регистрира...' : 'Регистрирај се'}
                </Button>
              </motion.div>
            </form>
            <Divider sx={{ my: 2, borderColor: isMobile ? undefined : alpha('#fff', 0.08) }} />
            <Typography
              variant="body2"
              textAlign="center"
              sx={{ color: isMobile ? 'text.secondary' : alpha('#fff', 0.45) }}
            >
              Веќе имате сметка?{' '}
              <Link
                component={RouterLink}
                to="/login"
                underline="none"
                fontWeight={700}
                sx={{ background: 'linear-gradient(135deg, #059669, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', '&:hover': { filter: 'brightness(1.3)' } }}
              >
                Најавете се
              </Link>
            </Typography>
          </Paper>
        </motion.div>
      </Box>
    </Box>
  );
}
