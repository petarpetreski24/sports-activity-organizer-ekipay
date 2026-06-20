import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, CardContent, TextField, Chip, Pagination,
  FormControl, InputLabel, Select, MenuItem, Switch,
  FormControlLabel, Rating, ToggleButtonGroup, ToggleButton, alpha,
  IconButton, Divider, LinearProgress, Button, CircularProgress,
  useMediaQuery, useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  Search, Event as EventIcon, Place, Map, ViewList, MyLocation,
  FilterList, ExpandMore, ExpandLess, SearchOff,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { SportEvent, Sport, EventSearchParams, SKILL_LEVEL_LABELS } from '../../types';
import { useSports } from '../../hooks/useSports';
import { useEventSearch } from '../../hooks/useEventSearch';
import { EVENT_STATUS_LABELS } from '../../types';
import { getSportIcon } from '../../utils/sportIcons';
import EventsMapView from '../../components/EventsMapView';
import AnimatedPage from '../../components/AnimatedPage';
import AnimatedCard from '../../components/AnimatedCard';
import { CardSkeleton } from '../../components/LoadingSkeleton';
import GlassCard from '../../components/GlassCard';
import SectionHeader from '../../components/SectionHeader';
import EmptyState from '../../components/EmptyState';
import GradientButton from '../../components/GradientButton';
import dayjs, { Dayjs } from 'dayjs';

export default function EventListPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [keyword, setKeyword] = useState('');
  const [selectedSport, setSelectedSport] = useState<number | ''>('');
  const [showFull, setShowFull] = useState(true);
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [minSkillLevel, setMinSkillLevel] = useState<string>('');
  const [userLat, setUserLat] = useState<number | undefined>();
  const [userLng, setUserLng] = useState<number | undefined>();
  const [radiusKm, setRadiusKm] = useState<number | undefined>();
  const [filtersExpanded, setFiltersExpanded] = useState(!isMobile);
  const [locationLoading, setLocationLoading] = useState(false);
  const pageSize = 12;

  const { data: sports = [] } = useSports();

  const searchParams = useMemo<EventSearchParams>(() => ({
    keyword: keyword || undefined,
    sportIds: selectedSport ? [selectedSport as number] : undefined,
    dateFrom: dateFrom ? dateFrom.format('YYYY-MM-DD') : undefined,
    dateTo: dateTo ? dateTo.format('YYYY-MM-DD') : undefined,
    minSkillLevel: minSkillLevel || undefined,
    statuses: showFull ? ['Open', 'Full'] : ['Open'],
    sortBy, page, pageSize,
    lat: userLat, lng: userLng, radiusKm,
  }), [keyword, selectedSport, dateFrom, dateTo, minSkillLevel, showFull, sortBy, page, userLat, userLng, radiusKm]);

  const { data: searchResult, isFetching: loading } = useEventSearch(searchParams);
  const events = searchResult?.items ?? [];
  const totalCount = searchResult?.totalCount ?? 0;

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          if (!radiusKm) setRadiusKm(25);
          if (sortBy !== 'distance') setSortBy('distance');
          setPage(1);
          setLocationLoading(false);
        },
        () => {
          alert('Не може да се пристапи до локацијата.');
          setLocationLoading(false);
        }
      );
    }
  };

  const clearLocation = () => {
    setUserLat(undefined); setUserLng(undefined); setRadiusKm(undefined);
    if (sortBy === 'distance') setSortBy('date');
    setPage(1);
  };

  return (
    <AnimatedPage>
      {/* Header */}
      <Box
        display="flex"
        alignItems={isMobile ? 'flex-start' : 'center'}
        justifyContent="space-between"
        flexDirection={isMobile ? 'column' : 'row'}
        gap={isMobile ? 1.5 : 0}
        mb={3}
      >
        <SectionHeader
          icon={<EventIcon />}
          title="Пребарај настани"
          count={totalCount}
        />
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          size="small"
        >
          <ToggleButton value="list" sx={{ borderRadius: '8px 0 0 8px', px: 2 }}>
            <ViewList sx={{ mr: 0.5, fontSize: 20 }} /> Листа
          </ToggleButton>
          <ToggleButton value="map" sx={{ borderRadius: '0 8px 8px 0', px: 2 }}>
            <Map sx={{ mr: 0.5, fontSize: 20 }} /> Мапа
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Collapsible filter panel */}
      <GlassCard hoverEffect={false} sx={{ mb: 3, p: { xs: 2, sm: 3 } }}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{ cursor: 'pointer' }}
          onClick={() => setFiltersExpanded((prev) => !prev)}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <FilterList sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Филтри
            </Typography>
          </Box>
          <IconButton size="small">
            {filtersExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        {/* Search always visible */}
        <Box mt={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Пребарај..."
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
            }}
          />
        </Box>

        <AnimatePresence initial={false}>
          {filtersExpanded && (
            <motion.div
              key="filters"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <Divider sx={{ my: 2 }} />

              {/* Row 1: Sport, Sort, Show Full */}
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 6, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Спорт</InputLabel>
                    <Select
                      value={selectedSport}
                      label="Спорт"
                      onChange={(e) => { setSelectedSport(e.target.value as number); setPage(1); }}
                    >
                      <MenuItem value="">Сите</MenuItem>
                      {sports.map((s) => (
                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Сортирај</InputLabel>
                    <Select
                      value={sortBy}
                      label="Сортирај"
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <MenuItem value="date">По датум</MenuItem>
                      <MenuItem value="rating">По оценка</MenuItem>
                      {userLat && <MenuItem value="distance">По оддалеченост</MenuItem>}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showFull}
                        onChange={(e) => { setShowFull(e.target.checked); setPage(1); }}
                        color="primary"
                      />
                    }
                    label="Прикажи полни"
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Row 2: Date range, Skill level, Location */}
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 6, md: 2.5 }}>
                  <DatePicker
                    label="Од датум"
                    value={dateFrom}
                    onChange={(v) => { setDateFrom(v); setPage(1); }}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 2.5 }}>
                  <DatePicker
                    label="До датум"
                    value={dateTo}
                    onChange={(v) => { setDateTo(v); setPage(1); }}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 2 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Ниво</InputLabel>
                    <Select
                      value={minSkillLevel}
                      label="Ниво"
                      onChange={(e) => { setMinSkillLevel(e.target.value); setPage(1); }}
                    >
                      <MenuItem value="">Сите</MenuItem>
                      {Object.entries(SKILL_LEVEL_LABELS).map(([key, label]) => (
                        <MenuItem key={key} value={key}>{label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6, md: 2.5 }}>
                  {!userLat ? (
                    <GradientButton
                      size="small"
                      startIcon={locationLoading ? <CircularProgress size={16} color="inherit" /> : <MyLocation />}
                      onClick={handleUseMyLocation}
                      fullWidth
                      disabled={locationLoading}
                    >
                      {locationLoading ? 'Се бара...' : 'Моја локација'}
                    </GradientButton>
                  ) : (
                    <Box display="flex" gap={1} alignItems="center">
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <InputLabel>Радиус</InputLabel>
                        <Select
                          value={radiusKm || 25}
                          label="Радиус"
                          onChange={(e) => { setRadiusKm(e.target.value as number); setPage(1); }}
                        >
                          {[1, 5, 10, 25, 50, 100].map((r) => (
                            <MenuItem key={r} value={r}>{r} km</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Button size="small" onClick={clearLocation} color="error" variant="text">X</Button>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* Content area */}
      {loading ? (
        <CardSkeleton count={6} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<SearchOff />}
          title="Нема пронајдени настани"
          description="Нема настани кои ги задоволуваат критериумите. Обидете се со промена на филтрите."
        />
      ) : viewMode === 'map' ? (
        <EventsMapView events={events} />
      ) : (
        <>
          <Grid container spacing={2}>
            {events.map((event, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={event.id}>
                <AnimatedCard
                  delay={i * 0.06}
                  variant="gradient"
                  onClick={() => navigate(`/events/${event.id}`)}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        {event.sportIcon && (
                          <Box sx={{ color: 'primary.main', display: 'flex' }}>
                            {getSportIcon(event.sportIcon, 18)}
                          </Box>
                        )}
                        <Chip label={event.sportName} size="small" color="primary" variant="outlined" />
                      </Box>
                      <Chip
                        label={EVENT_STATUS_LABELS[event.status] || event.status}
                        size="small"
                        color={event.status === 'Open' ? 'success' : event.status === 'Full' ? 'warning' : 'default'}
                      />
                    </Box>
                    <Typography variant="subtitle1" gutterBottom noWrap fontWeight={600} sx={{ lineHeight: 1.3 }}>
                      {event.title}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                      <EventIcon sx={{ fontSize: 16 }} color="action" />
                      <Typography variant="body2" color="text.secondary" fontSize={13}>
                        {dayjs(event.eventDate).format('DD.MM.YYYY HH:mm')} ({event.durationMinutes} мин)
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5} mb={1.5}>
                      <Place sx={{ fontSize: 16 }} color="action" />
                      <Typography variant="body2" color="text.secondary" noWrap fontSize={13}>
                        {event.locationAddress}
                      </Typography>
                    </Box>

                    {/* Participant progress bar */}
                    <Box mb={1}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                        <Typography variant="body2" fontWeight={500} fontSize={13}>
                          {event.currentParticipants}/{event.maxParticipants} учесници
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {Math.round((event.currentParticipants / event.maxParticipants) * 100)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(event.currentParticipants / event.maxParticipants) * 100}
                        sx={{
                          height: 5,
                          borderRadius: 3,
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            background: 'linear-gradient(90deg, #1a56db, #059669)',
                          },
                        }}
                      />
                    </Box>

                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      pt={1}
                      borderTop="1px solid"
                      borderColor="divider"
                    >
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Typography variant="body2" fontSize={13}>{event.organizerName}</Typography>
                        {event.organizerRating && (
                          <Rating value={event.organizerRating} readOnly size="small" precision={0.5} />
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </AnimatedCard>
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {Math.ceil(totalCount / pageSize) > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <GlassCard noPadding hoverEffect={false}>
                <Box px={2} py={1} display="flex" justifyContent="center">
                  <Pagination
                    count={Math.ceil(totalCount / pageSize)}
                    page={page}
                    onChange={(_, v) => setPage(v)}
                    color="primary"
                    size={isMobile ? 'small' : 'medium'}
                    sx={{ '& .MuiPaginationItem-root': { borderRadius: 2 } }}
                  />
                </Box>
              </GlassCard>
            </Box>
          )}
        </>
      )}
    </AnimatedPage>
  );
}
