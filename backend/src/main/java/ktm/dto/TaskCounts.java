package ktm.dto;

/** Counters for the filter tabs. With pagination they cannot be computed client-side. */
public record TaskCounts(long all, long active, long completed) {}