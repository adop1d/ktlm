package ktlm.model;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Title is required")
    @Size(max = 500, message = "Title must not exceed 500 characters")
    private String title;

    @Size(max = 4000, message = "Description must not exceed 4000 characters")
    private String description;

    private boolean completed;

    @Enumerated(EnumType.STRING)
    private Priority priority = Priority.MEDIUM;

    private LocalDate dueDate;

    private Integer sortOrder = 0;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Long userId;  // Para asociar tarea con usuario

    // --- Interoperabilidad con todo.txt -------------------------------------------------

    /** Fecha de completado; solo presente en tareas cerradas. */
    private LocalDateTime completedAt;

    /** Literal del token `rec:` sin el prefijo, p. ej. "+1m". */
    @Size(max = 50)
    private String recurrence;

    /** Literal del token `t:` sin el prefijo, p. ej. "-3d". */
    @Size(max = 50)
    private String threshold;

    /**
     * Cuerpo largo de la tarea, sin el prefijo del token `note:`.
     *
     * <p>Es lo que se abre en el editor con `O` y lo que se escribe con `o`. Cabe en una
     * línea del archivo pero no en el título, así que va aparte.
     */
    @Size(max = 4000)
    private String note;

    /**
     * Identidad estable para el round-trip archivo <-> base de datos. Se escribe como el
     * token `uid:` de la línea, que tuxedo conserva sin alterar. Único por cuenta.
     */
    @Column(name = "todo_uid")
    @Size(max = 64)
    private String todoUid;

    /** Otros tokens key:valor del archivo que no son due/rec/t/uid, en orden de aparición. */
    @Column(columnDefinition = "text")
    private String extras;

    @ElementCollection(fetch = FetchType.EAGER)
    @BatchSize(size = 50)
    @CollectionTable(name = "task_project", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "project")
    private Set<String> projects = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @BatchSize(size = 50)
    @CollectionTable(name = "task_context", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "context")
    private Set<String> contexts = new LinkedHashSet<>();

    public enum Priority {
        LOW, MEDIUM, HIGH
    }

    // Constructors
    public Task() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public Task(String title, String description) {
        this();
        this.title = title;
        this.description = description;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public String getRecurrence() {
        return recurrence;
    }

    public void setRecurrence(String recurrence) {
        this.recurrence = recurrence;
    }

    public String getThreshold() {
        return threshold;
    }

    public void setThreshold(String threshold) {
        this.threshold = threshold;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getTodoUid() {
        return todoUid;
    }

    public void setTodoUid(String todoUid) {
        this.todoUid = todoUid;
    }

    public String getExtras() {
        return extras;
    }

    public void setExtras(String extras) {
        this.extras = extras;
    }

    public Set<String> getProjects() {
        return projects;
    }

    public void setProjects(Set<String> projects) {
        this.projects = projects == null ? new LinkedHashSet<>() : new LinkedHashSet<>(projects);
    }

    public Set<String> getContexts() {
        return contexts;
    }

    public void setContexts(Set<String> contexts) {
        this.contexts = contexts == null ? new LinkedHashSet<>() : new LinkedHashSet<>(contexts);
    }

    // Methods
    public void updateTimestamp() {
        this.updatedAt = LocalDateTime.now();
    }
}