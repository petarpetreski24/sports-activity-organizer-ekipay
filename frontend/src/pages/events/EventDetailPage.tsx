import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Button, Chip, Avatar, Rating, Divider,
  Alert, TextField, IconButton, List, ListItem, ListItemAvatar, ListItemText,
  alpha, Tooltip, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  CalendarMonth, Timer, Place, Person, CheckCircle, Cancel, Send, Delete,
  Groups, FitnessCenter, Chat, Star, EditOutlined, CancelOutlined, Bolt, Flag,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { SportEvent, EventApplication, EventComment, EventRating, RatableParticipant } from '../../types';
import * as eventsApi from '../../api/events';
import * as applicationsApi from '../../api/applications';
import * as commentsApi from '../../api/comments';
import * as ratingsApi from '../../api/ratings';
import * as reportsApi from '../../api/reports';
import { useAuth } from '../../contexts/AuthContext';
import { EVENT_STATUS_LABELS, SKILL_LEVEL_LABELS } from '../../types';
import EventMap from '../../components/EventMap';
import AnimatedPage from '../../components/AnimatedPage';
import { CardSkeleton } from '../../components/LoadingSkeleton';
import GlassCard from '../../components/GlassCard';
import SectionHeader from '../../components/SectionHeader';
import EmptyState from '../../components/EmptyState';
import GradientButton from '../../components/GradientButton';
import AnimatedDialog from '../../components/AnimatedDialog';
import { getWeatherForEvent, WeatherInfo } from '../../utils/weather';
import dayjs from 'dayjs';

const REPORT_REASONS = [
  { value: 'InappropriateBehavior', label: 'Несоодветно однесување' },
  { value: 'Spam', label: 'Спам' },
  { value: 'Harassment', label: 'Вознемирување' },
  { value: 'FakeProfile', label: 'Лажен профил' },
  { value: 'NoShow', label: 'Недоаѓање на настан' },
  { value: 'Other', label: 'Друго' },
];

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<SportEvent | null>(null);
  const [applications, setApplications] = useState<EventApplication[]>([]);
  const [myApplication, setMyApplication] = useState<EventApplication | null>(null);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [ratings, setRatings] = useState<EventRating[]>([]);
  const [ratableParticipants, setRatableParticipants] = useState<RatableParticipant[]>([]);
  const [newComment, setNewComment] = useState('');
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [removeDialog, setRemoveDialog] = useState<{ userId: number; userName: string } | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [peerRatings, setPeerRatings] = useState<Record<number, { rating: number; comment: string }>>({});
  const [error, setError] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [reportDialog, setReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const { isAdmin } = useAuth();
  const isOrganizer = user?.id === event?.organizerId;
  const canManage = isOrganizer || isAdmin;
  const isApproved = myApplication?.status === 'Approved' || isOrganizer || isAdmin;
  const hasActiveApplication = myApplication?.status === 'Pending' || myApplication?.status === 'Approved';
  const isCompleted = event?.status === 'Completed';
  const isCancelled = event?.status === 'Cancelled';
  const minutesToStart = event ? dayjs(event.eventDate).diff(dayjs(), 'minute') : Infinity;
  const canApply = minutesToStart > 120;
  const canRate = isCompleted && isApproved && !ratings.some(r => r.reviewerId === user?.id) &&
    dayjs().diff(dayjs(event?.eventDate).add(event?.durationMinutes || 0, 'minute'), 'day') <= 7;

  const handleReport = async () => {
    if (!reportReason) return;
    setReportSubmitting(true);
    try {
      await reportsApi.create({
        reportedEventId: event?.id,
        reason: reportReason,
        description: reportDescription || undefined,
      });
      setReportDialog(false);
      setReportReason('');
      setReportDescription('');
    } catch {}
    setReportSubmitting(false);
  };

  const load = async () => {
    if (!id) return;
    try {
      const { data: ev } = await eventsApi.getById(parseInt(id));
      setEvent(ev);
      const isOrgOrAdmin = user?.id === ev.organizerId || user?.role === 'Admin';
      if (isAuthenticated) {
        if (isOrgOrAdmin) {
          try { const { data: apps } = await applicationsApi.getEventApplications(parseInt(id)); setApplications(apps); } catch { }
        } else {
          try { const { data: myApp } = await applicationsApi.getMyApplication(parseInt(id)); setMyApplication(myApp || null); } catch { }
        }
        try { const { data: cmts } = await commentsApi.getComments(parseInt(id)); setComments(cmts); } catch { }
        if (ev.status === 'Completed') {
          try { const { data: rp } = await ratingsApi.getRatableParticipants(parseInt(id)); setRatableParticipants(rp); } catch { }
        }
      }
      try { const { data: rats } = await ratingsApi.getEventRatings(parseInt(id)); setRatings(rats); } catch { }
      // Fetch weather
      getWeatherForEvent(ev.locationLat, ev.locationLng, ev.eventDate).then(w => setWeather(w));
    } catch { setError('Настанот не е пронајден.'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id, isAuthenticated]);

  const handleApply = async () => {
    if (!id) return;
    try { await applicationsApi.apply(parseInt(id)); setApplySuccess(true); setTimeout(() => setApplySuccess(false), 3000); load(); } catch (e: any) { setError(e.response?.data?.error || 'Грешка'); }
  };

  const handleCancelApplication = async () => {
    if (!id || !myApplication) return;
    try { await applicationsApi.cancelApplication(parseInt(id), myApplication.id); setMyApplication(null); load(); } catch (e: any) { setError(e.response?.data?.error || 'Грешка'); }
  };

  const handleCancel = async () => {
    if (!id) return;
    await eventsApi.cancel(parseInt(id));
    setCancelDialog(false);
    load();
  };

  const handleAddComment = async () => {
    if (!id || !newComment.trim()) return;
    await commentsApi.createComment(parseInt(id), newComment);
    setNewComment('');
    load();
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!id) return;
    try { await commentsApi.deleteComment(parseInt(id), commentId); load(); } catch (e: any) { setError(e.response?.data?.error || 'Грешка'); }
  };

  const handleRate = async () => {
    if (!id || !ratingValue) return;
    await ratingsApi.rateEvent(parseInt(id), { rating: ratingValue, comment: ratingComment || undefined });
    setRatingValue(0); setRatingComment('');
    load();
  };

  const handleRateParticipant = async (participantId: number) => {
    if (!id) return;
    const pr = peerRatings[participantId];
    if (!pr?.rating) return;
    try {
      await ratingsApi.rateParticipant(parseInt(id), { participantId, rating: pr.rating, comment: pr.comment || undefined });
      setPeerRatings(prev => { const n = { ...prev }; delete n[participantId]; return n; });
      load();
    } catch (e: any) { setError(e.response?.data?.error || 'Грешка'); }
  };

  const handleRemoveParticipant = async () => {
    if (!id || !removeDialog) return;
    try { await applicationsApi.removeParticipant(parseInt(id), removeDialog.userId, removeReason || undefined); setRemoveDialog(null); setRemoveReason(''); load(); } catch (e: any) { setError(e.response?.data?.error || 'Грешка'); }
  };

  if (loading) return <Box mt={4}><CardSkeleton count={2} /></Box>;
  if (!event) return <Alert severity="error">Настанот не е пронајден.</Alert>;

  const participantPercent = event.maxParticipants > 0
    ? (event.currentParticipants / event.maxParticipants) * 100
    : 0;

  return (
    <AnimatedPage>
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }} onClose={() => setError('')}>{error}</Alert>
          </motion.div>
        )}
        {applySuccess && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Alert severity="success" sx={{ mb: 2, borderRadius: 3 }}>Успешно се пријавивте!</Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <GlassCard
          variant="gradient"
          hoverEffect={false}
          sx={{
            mb: 3,
            background: `linear-gradient(135deg, ${alpha('#1a56db', 0.04)} 0%, ${alpha('#059669', 0.06)} 100%)`,
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip
                label={event.sportName}
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #1a56db, #059669)',
                  color: '#fff',
                }}
              />
              <Chip
                label={EVENT_STATUS_LABELS[event.status] || event.status}
                color={event.status === 'Open' ? 'success' : event.status === 'Full' ? 'warning' : 'default'}
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            </Box>
            {canManage && event.status !== 'Completed' && event.status !== 'Cancelled' && (
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditOutlined />}
                  onClick={() => navigate(`/events/${id}/edit`)}
                  sx={{ borderRadius: 2 }}
                >
                  Уреди
                </Button>
                {event.status === 'Open' && (
                  <Button
                    size="small"
                    variant={event.isLastMinute ? 'contained' : 'outlined'}
                    color="warning"
                    startIcon={<Bolt />}
                    onClick={async () => {
                      try {
                        await eventsApi.toggleLastMinute(event.id);
                        load();
                      } catch {}
                    }}
                    sx={{
                      borderRadius: 2,
                      ...(event.isLastMinute && {
                        background: 'linear-gradient(135deg, #dc2626, #f59e0b)',
                        color: '#fff',
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.85 } },
                      }),
                    }}
                  >
                    {event.isLastMinute ? 'Итен повик ✓' : 'Итен повик'}
                  </Button>
                )}
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  startIcon={<CancelOutlined />}
                  onClick={() => setCancelDialog(true)}
                  sx={{ borderRadius: 2 }}
                >
                  Откажи
                </Button>
              </Box>
            )}
          </Box>

          <Box display="flex" alignItems="flex-start" gap={1} mb={2}>
            <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1.2, flex: 1 }}>
              {event.title}
            </Typography>
            {isAuthenticated && !canManage && (
              <IconButton size="small" onClick={() => setReportDialog(true)} sx={{ color: 'text.secondary', mt: 0.5 }}>
                <Flag fontSize="small" />
              </IconButton>
            )}
          </Box>

          {/* Horizontal info boxes row */}
          <Box
            display="flex"
            gap={1.5}
            flexWrap="wrap"
            mb={2.5}
          >
            {[
              { icon: <CalendarMonth fontSize="small" />, text: dayjs(event.eventDate).format('DD.MM.YYYY HH:mm'), full: dayjs(event.eventDate).format('DD.MM.YYYY HH:mm') },
              { icon: <Timer fontSize="small" />, text: `${event.durationMinutes} мин.`, full: `${event.durationMinutes} минути` },
              { icon: <Place fontSize="small" />, text: event.locationAddress, full: event.locationAddress },
              { icon: <Groups fontSize="small" />, text: `${event.currentParticipants}/${event.maxParticipants}`, full: `${event.currentParticipants} од ${event.maxParticipants} учесници` },
            ].map((item, i) => (
              <Tooltip key={i} title={item.full} arrow enterDelay={300}>
                <Box
                  display="flex"
                  alignItems="center"
                  gap={0.75}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: 'action.hover',
                    border: `1px solid`,
                    borderColor: 'divider',
                    maxWidth: { xs: '100%', sm: 'auto' },
                  }}
                >
                  <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{item.icon}</Box>
                  <Typography variant="body2" fontWeight={500} noWrap>{item.text}</Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>

          {/* Weather info */}
          {weather && (
            <Box
              display="flex" alignItems="center" gap={1} mb={2}
              sx={{
                px: 2, py: 1, borderRadius: 2,
                bgcolor: weather.isOutdoorFriendly ? alpha('#059669', 0.06) : alpha('#f59e0b', 0.08),
                border: `1px solid ${weather.isOutdoorFriendly ? alpha('#059669', 0.15) : alpha('#f59e0b', 0.2)}`,
              }}
            >
              <Typography fontSize={24}>{weather.icon}</Typography>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {weather.temp}°C · {weather.description}
                </Typography>
                {weather.warning && (
                  <Typography variant="caption" color={weather.isOutdoorFriendly ? 'text.secondary' : 'warning.main'} fontWeight={600}>
                    ⚠ {weather.warning}
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Participant progress bar */}
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Учесници
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {event.currentParticipants}/{event.maxParticipants}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={participantPercent}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: alpha('#1a56db', 0.08),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #1a56db, #059669)',
                },
              }}
            />
          </Box>
        </GlassCard>
      </motion.div>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          {/* Description */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <GlassCard sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {event.description}
              </Typography>
            </GlassCard>
          </motion.div>

          {/* Info detail cards */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                { icon: <CalendarMonth />, label: 'Датум', value: dayjs(event.eventDate).format('DD.MM.YYYY HH:mm') },
                { icon: <Timer />, label: 'Времетраење', value: `${event.durationMinutes} минути` },
                { icon: <Place />, label: 'Локација', value: event.locationAddress },
                { icon: <Groups />, label: 'Учесници', value: `${event.currentParticipants} / ${event.maxParticipants}` },
                ...(event.minSkillLevel ? [{
                  icon: <FitnessCenter />,
                  label: 'Мин. ниво',
                  value: SKILL_LEVEL_LABELS[event.minSkillLevel] || event.minSkillLevel,
                }] : []),
              ].map((item, i) => (
                <Grid size={{ xs: 6, sm: 4 }} key={i}>
                  <Tooltip title={item.value} arrow enterDelay={300} placement="top">
                    <Box>
                      <GlassCard hoverEffect={false} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2 }}>
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${alpha('#1a56db', 0.1)}, ${alpha('#059669', 0.1)})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#1a56db',
                            flexShrink: 0,
                          }}
                        >
                          {item.icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {item.label}
                          </Typography>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {item.value}
                          </Typography>
                        </Box>
                      </GlassCard>
                    </Box>
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </motion.div>

          {/* Map Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <SectionHeader icon={<Place />} title="Локација" />
            <GlassCard noPadding sx={{ mb: 3, overflow: 'hidden' }}>
              <EventMap
                lat={event.locationLat}
                lng={event.locationLng}
                address={event.locationAddress}
                title={event.title}
                userLat={user?.locationLat ?? undefined}
                userLng={user?.locationLng ?? undefined}
              />
            </GlassCard>
          </motion.div>

          {/* Apply Button */}
          {isAuthenticated && !canManage && event.status === 'Open' && !hasActiveApplication && (
            <Box sx={{ mb: 3 }}>
              {canApply ? (
                <GradientButton
                  fullWidth
                  gradientFrom="#059669"
                  gradientTo="#16a34a"
                  hoverFrom="#064e3b"
                  hoverTo="#059669"
                  onClick={handleApply}
                  sx={{ py: 1.8, fontSize: '1.05rem', borderRadius: 3 }}
                >
                  Пријави се на настанот
                </GradientButton>
              ) : (
                <Alert severity="warning" sx={{ borderRadius: 3 }}>
                  Пријавувањето е затворено — настанот започнува за помалку од 2 часа.
                </Alert>
              )}
            </Box>
          )}

          {/* My Application Status */}
          {myApplication && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Alert
                severity={myApplication.status === 'Approved' ? 'success' : myApplication.status === 'Pending' ? 'info' : 'warning'}
                sx={{ mb: 3, borderRadius: 3 }}
                action={hasActiveApplication && canApply ? <Button size="small" color="inherit" onClick={handleCancelApplication}>Откажи</Button> : undefined}
              >
                Статус: <strong>{myApplication.status === 'Approved' ? 'Одобрена' : myApplication.status === 'Pending' ? 'Чека одобрување...' : myApplication.status === 'Rejected' ? 'Одбиена' : 'Откажана'}</strong>
              </Alert>
            </motion.div>
          )}

          {/* Comments Section - only accepted participants, organizer, and admin */}
          {isAuthenticated && isApproved && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <SectionHeader icon={<Chat />} title="Коментари" count={comments.length} />
              <GlassCard sx={{ mb: 3 }}>
                {comments.length === 0 && (
                  <EmptyState
                    icon={<Chat />}
                    title="Нема коментари"
                    description={isApproved ? 'Бидете први кој ќе остави коментар за овој настан.' : 'Сеуште нема коментари за овој настан.'}
                  />
                )}
                <AnimatePresence>
                  {comments.map(c => (
                    <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                      <Box sx={{ mb: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <Avatar
                          src={c.userPhotoUrl}
                          sx={{ width: 36, height: 36, cursor: 'pointer', mt: 0.5 }}
                          onClick={() => navigate(`/users/${c.userId}`)}
                        >
                          {c.userName[0]}
                        </Avatar>
                        <Box
                          flex={1}
                          sx={{
                            p: 1.5,
                            bgcolor: alpha('#1a56db', 0.04),
                            borderRadius: '4px 16px 16px 16px',
                          }}
                        >
                          <Typography variant="subtitle2">
                            <Typography
                              component="span"
                              variant="subtitle2"
                              sx={{ cursor: 'pointer', fontWeight: 700, '&:hover': { color: 'primary.main' } }}
                              onClick={() => navigate(`/users/${c.userId}`)}
                            >
                              {c.userName}
                            </Typography>{' '}
                            <Typography component="span" variant="caption" color="text.secondary">
                              {dayjs(c.createdAt).format('DD.MM HH:mm')}
                            </Typography>
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.25 }}>{c.content}</Typography>
                        </Box>
                        {!isCompleted && (c.userId === user?.id || isOrganizer) && (
                          <Tooltip title="Избриши">
                            <IconButton size="small" color="error" onClick={() => handleDeleteComment(c.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Comment input bar - only for organizer or approved participants */}
                {isApproved ? (
                  <Box
                    display="flex"
                    gap={1}
                    mt={comments.length > 0 ? 2 : 0}
                    alignItems="center"
                    sx={{
                      p: 0.5,
                      pl: 2,
                      borderRadius: 50,
                      bgcolor: alpha('#1a56db', 0.04),
                      border: `1px solid ${alpha('#1a56db', 0.08)}`,
                    }}
                  >
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Напиши коментар..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      variant="standard"
                      InputProps={{ disableUnderline: true }}
                      sx={{ '& .MuiInputBase-input': { py: 0.75 } }}
                    />
                    <IconButton
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      sx={{
                        background: 'linear-gradient(135deg, #1a56db, #059669)',
                        color: '#fff',
                        width: 38,
                        height: 38,
                        '&:hover': {
                          background: 'linear-gradient(135deg, #1e3a5f, #064e3b)',
                        },
                        '&.Mui-disabled': {
                          background: alpha('#94a3b8', 0.3),
                          color: alpha('#fff', 0.6),
                        },
                      }}
                    >
                      <Send fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: comments.length > 0 ? 2 : 0, fontStyle: 'italic', textAlign: 'center' }}>
                    Само одобрени учесници и организаторот можат да коментираат.
                  </Typography>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* Ratings Section */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <SectionHeader
              icon={<Star />}
              title="Оценки"
              subtitle={event.avgRating ? `Просечна оценка: ${event.avgRating.toFixed(1)}` : undefined}
              count={ratings.length}
            />
            {!isCompleted ? (
              <GlassCard hoverEffect={false} sx={{ mb: 3, textAlign: 'center', py: 4 }}>
                <Star sx={{ fontSize: 40, color: alpha('#f59e0b', 0.4), mb: 1 }} />
                <Typography variant="body1" fontWeight={600} mb={0.5}>
                  Оценувањето е достапно по завршување на настанот
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  По завршување ќе можете да го оцените настанот и учесниците.
                </Typography>
              </GlassCard>
            ) : (
              <>
                {ratings.length === 0 && !canRate && (
                  <EmptyState
                    icon={<Star />}
                    title="Нема оценки"
                    description="Овој настан сеуште нема оценки од учесниците."
                  />
                )}
                {ratings.length > 0 && (
                  <GlassCard sx={{ mb: 3, p: 2 }}>
                    <Box
                      sx={{
                        maxHeight: 280,
                        overflowY: 'auto',
                        pr: 1,
                        '&::-webkit-scrollbar': { width: 4 },
                        '&::-webkit-scrollbar-thumb': {
                          borderRadius: 2,
                          bgcolor: alpha('#1a56db', 0.2),
                        },
                      }}
                    >
                      {ratings.map((r, i) => (
                        <Box
                          key={r.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.5,
                            py: 1.5,
                            borderBottom: i < ratings.length - 1 ? `1px solid ${alpha('#1a56db', 0.06)}` : 'none',
                          }}
                        >
                          <Avatar
                            src={r.reviewerPhotoUrl}
                            sx={{ width: 32, height: 32, cursor: 'pointer', mt: 0.25 }}
                            onClick={() => navigate(`/users/${r.reviewerId}`)}
                          >
                            {r.reviewerName[0]}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                              <Typography
                                variant="body2"
                                sx={{ cursor: 'pointer', fontWeight: 700, '&:hover': { color: 'primary.main' } }}
                                onClick={() => navigate(`/users/${r.reviewerId}`)}
                              >
                                {r.reviewerName}
                              </Typography>
                              <Rating value={r.rating} readOnly size="small" />
                              <Typography variant="caption" color="text.secondary">
                                {dayjs(r.createdAt).format('DD.MM.YYYY')}
                              </Typography>
                            </Box>
                            {r.comment && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, fontSize: 13 }}>
                                {r.comment}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </GlassCard>
                )}
                {canRate && (
                  <GlassCard variant="gradient" sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" mb={1} fontWeight={700}>Оцени го настанот</Typography>
                    <Rating value={ratingValue} onChange={(_, v) => setRatingValue(v || 0)} size="large" />
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Коментар (опционално)"
                      value={ratingComment}
                      onChange={e => setRatingComment(e.target.value)}
                      sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />
                    <GradientButton
                      size="small"
                      onClick={handleRate}
                      disabled={!ratingValue}
                      sx={{ mt: 1.5, borderRadius: 2 }}
                    >
                      Испрати
                    </GradientButton>
                  </GlassCard>
                )}
              </>
            )}
          </motion.div>

          {/* Peer Ratings Section - Horizontal scrollable cards */}
          {isCompleted && ratableParticipants.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <SectionHeader
                icon={<Groups />}
                title="Оцени учесници"
                subtitle={`Оценете ги учесниците за ${event.sportName}.`}
              />
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  overflowX: 'auto',
                  pb: 2,
                  mb: 3,
                  '&::-webkit-scrollbar': { height: 4 },
                  '&::-webkit-scrollbar-thumb': {
                    borderRadius: 2,
                    bgcolor: alpha('#1a56db', 0.2),
                  },
                }}
              >
                {ratableParticipants.map(p => (
                  <GlassCard
                    key={p.userId}
                    sx={{
                      minWidth: 220,
                      maxWidth: 260,
                      flexShrink: 0,
                      p: 2,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                      <Avatar
                        src={p.userPhotoUrl}
                        sx={{ width: 36, height: 36, cursor: 'pointer' }}
                        onClick={() => navigate(`/users/${p.userId}`)}
                      >
                        {p.userName[0]}
                      </Avatar>
                      <Box minWidth={0}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ cursor: 'pointer', fontWeight: 700, '&:hover': { color: 'primary.main' } }}
                          onClick={() => navigate(`/users/${p.userId}`)}
                        >
                          {p.userName}
                        </Typography>
                        {p.avgRating != null && (
                          <Typography variant="caption" color="text.secondary">
                            {p.avgRating.toFixed(1)} ★
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Rating
                      size="small"
                      value={peerRatings[p.userId]?.rating || 0}
                      onChange={(_, v) => setPeerRatings(prev => ({
                        ...prev,
                        [p.userId]: { rating: v || 0, comment: prev[p.userId]?.comment || '' },
                      }))}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Коментар..."
                      sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 }, '& .MuiInputBase-input': { fontSize: 13 } }}
                      value={peerRatings[p.userId]?.comment || ''}
                      onChange={e => setPeerRatings(prev => ({
                        ...prev,
                        [p.userId]: { rating: prev[p.userId]?.rating || 0, comment: e.target.value },
                      }))}
                    />
                    <GradientButton
                      size="small"
                      fullWidth
                      sx={{ mt: 1, borderRadius: 2, py: 0.5 }}
                      disabled={!peerRatings[p.userId]?.rating}
                      onClick={() => handleRateParticipant(p.userId)}
                    >
                      Оцени
                    </GradientButton>
                  </GlassCard>
                ))}
              </Box>
            </motion.div>
          )}
        </Grid>

        {/* Right Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Organizer Card */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <GlassCard
              sx={{ mb: 3, cursor: 'pointer' }}
              onClick={() => navigate(`/users/${event.organizerId}`)}
            >
              <Typography variant="overline" color="text.secondary" fontWeight={600} letterSpacing={1.2}>
                Организатор
              </Typography>
              <Box display="flex" alignItems="center" gap={2} mt={1}>
                <Avatar
                  src={event.organizerPhotoUrl}
                  sx={{
                    width: 72,
                    height: 72,
                    border: '3px solid transparent',
                    background: 'linear-gradient(white, white), linear-gradient(135deg, #1a56db, #059669)',
                    backgroundOrigin: 'border-box',
                    backgroundClip: 'padding-box, border-box',
                  }}
                >
                  {event.organizerName[0]}
                </Avatar>
                <Box>
                  <Typography fontWeight={700} variant="h6">{event.organizerName}</Typography>
                  {event.organizerRating && (
                    <Rating value={event.organizerRating} readOnly size="small" precision={0.5} />
                  )}
                </Box>
              </Box>
            </GlassCard>
          </motion.div>

          {/* Applications List (Organizer or Admin) */}
          {canManage && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <SectionHeader icon={<Person />} title="Пријави" count={applications.length} />
              {applications.length === 0 ? (
                <EmptyState
                  icon={<Person />}
                  title="Нема пријави"
                  description="Сеуште нема пријавени учесници за овој настан."
                />
              ) : (
                <GlassCard sx={{ p: 1.5 }}>
                  <Box display="flex" flexDirection="column" gap={0.75}>
                    {applications.map(app => (
                      <Box
                        key={app.id}
                        display="flex"
                        alignItems="center"
                        gap={1.5}
                        sx={{
                          borderRadius: 2,
                          py: 1.25,
                          px: 1.5,
                          bgcolor: alpha('#1a56db', 0.02),
                          '&:hover': { bgcolor: alpha('#1a56db', 0.05) },
                          transition: 'background 0.2s',
                        }}
                      >
                        <Avatar
                          src={app.userPhotoUrl}
                          sx={{ cursor: 'pointer', width: 38, height: 38, flexShrink: 0 }}
                          onClick={() => navigate(`/users/${app.userId}`)}
                        >
                          {app.userName[0]}
                        </Avatar>
                        <Box flex={1} minWidth={0}>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            noWrap
                            sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                            onClick={() => navigate(`/users/${app.userId}`)}
                          >
                            {app.userName}
                          </Typography>
                          {app.userAvgRating ? (
                            <Typography variant="caption" color="text.secondary">
                              {app.userAvgRating.toFixed(1)} ★
                            </Typography>
                          ) : null}
                        </Box>
                        <Box display="flex" alignItems="center" gap={0.5} flexShrink={0}>
                          {!isCompleted && app.status === 'Pending' ? (
                            <>
                              <IconButton size="small" color="success" onClick={() => applicationsApi.approve(event.id, app.id).then(load)}>
                                <CheckCircle />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={() => applicationsApi.reject(event.id, app.id).then(load)}>
                                <Cancel />
                              </IconButton>
                            </>
                          ) : app.status === 'Approved' ? (
                            <>
                              <Chip size="small" label="Одобрен" color="success" sx={{ fontWeight: 600 }} />
                              {!isCompleted && (
                                <IconButton
                                  size="small"
                                  color="error"
                                  title="Отстрани"
                                  onClick={() => setRemoveDialog({ userId: app.userId, userName: app.userName })}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              )}
                            </>
                          ) : (
                            <Chip size="small" label={app.status === 'Rejected' ? 'Одбиен' : app.status} />
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </GlassCard>
              )}
            </motion.div>
          )}
        </Grid>
      </Grid>

      {/* Cancel Event Dialog */}
      <AnimatedDialog
        open={cancelDialog}
        onClose={() => setCancelDialog(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Откажи настан?</DialogTitle>
        <DialogContent>
          <Typography>Сите пријавени учесници ќе бидат известени за откажувањето.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCancelDialog(false)} sx={{ borderRadius: 2 }}>Не</Button>
          <GradientButton
            gradientFrom="#dc2626"
            gradientTo="#ef4444"
            hoverFrom="#991b1b"
            hoverTo="#dc2626"
            onClick={handleCancel}
            sx={{ borderRadius: 2 }}
          >
            Откажи настан
          </GradientButton>
        </DialogActions>
      </AnimatedDialog>

      {/* Remove Participant Dialog */}
      <AnimatedDialog
        open={!!removeDialog}
        onClose={() => { setRemoveDialog(null); setRemoveReason(''); }}
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Отстрани учесник</DialogTitle>
        <DialogContent>
          <Typography mb={2}>
            Дали сте сигурни дека сакате да го отстраните <strong>{removeDialog?.userName}</strong>?
          </Typography>
          <TextField
            fullWidth
            label="Причина (опционално)"
            value={removeReason}
            onChange={e => setRemoveReason(e.target.value)}
            placeholder="Наведете причина..."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setRemoveDialog(null); setRemoveReason(''); }} sx={{ borderRadius: 2 }}>
            Откажи
          </Button>
          <GradientButton
            gradientFrom="#dc2626"
            gradientTo="#ef4444"
            hoverFrom="#991b1b"
            hoverTo="#dc2626"
            onClick={handleRemoveParticipant}
            sx={{ borderRadius: 2 }}
          >
            Отстрани
          </GradientButton>
        </DialogActions>
      </AnimatedDialog>
      {/* Report Dialog — uses plain Dialog to avoid AnimatedDialog remount on typing */}
      <Dialog open={reportDialog} onClose={() => setReportDialog(false)} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Пријави настан</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Причина</InputLabel>
            <Select value={reportReason} onChange={e => setReportReason(e.target.value)} label="Причина">
              {REPORT_REASONS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth multiline rows={3} label="Опис (опционално)" value={reportDescription}
            onChange={e => setReportDescription(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReportDialog(false)} sx={{ borderRadius: 2 }}>Откажи</Button>
          <GradientButton onClick={handleReport} disabled={!reportReason || reportSubmitting}
            gradientFrom="#dc2626" gradientTo="#ef4444" hoverFrom="#b91c1c" hoverTo="#dc2626"
            sx={{ borderRadius: 2 }}>Пријави</GradientButton>
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}
